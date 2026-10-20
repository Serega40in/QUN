import { readFile } from "node:fs/promises";

const DEFAULT_BASE = "https://qdxjltqlnphvzafapncm.supabase.co";
const DEFAULT_KEY = "sb_publishable_aCUwbGYj_kUU8nVUu1kWmQ_-d-8fp8L";

export function createComputeWorker({ credentialsFile, base = DEFAULT_BASE, publishableKey = DEFAULT_KEY, pollMs = 20000 } = {}) {
  let running = false;
  let loopPromise = null;
  let wakeTimer = null;
  let wakeResolve = null;
  let state = {
    running: false,
    mode: "idle",
    nodeId: null,
    startedAt: null,
    lastHeartbeatAt: null,
    lastJobAt: null,
    lastJobId: null,
    jobsCompleted: 0,
    jobsFailed: 0,
    lastError: null,
    message: "Вычисления выключены. Запустите их вручную."
  };

  async function credentials() {
    if (!credentialsFile) throw new Error("Не задан путь к учётным данным ноды.");
    let data;
    try {
      data = JSON.parse(await readFile(credentialsFile, "utf8"));
    } catch {
      throw new Error("Сначала зарегистрируйте QUN Node в основном приложении.");
    }
    if (typeof data.nodeId !== "string" || typeof data.nodeToken !== "string" || !data.nodeId || !data.nodeToken) {
      throw new Error("В файле регистрации ноды нет действительных учётных данных.");
    }
    return data;
  }

  async function api(action, creds, extra = {}) {
    const response = await fetch(base.replace(/\/$/, "") + "/functions/v1/qun-compute-node", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": publishableKey,
        "Authorization": "Bearer " + publishableKey
      },
      body: JSON.stringify({ action, nodeId: creds.nodeId, nodeToken: creds.nodeToken, ...extra }),
      signal: AbortSignal.timeout(25000)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.error) throw new Error(result.error || ("Compute API HTTP " + response.status));
    return result;
  }

  const sleep = ms => new Promise(resolve => {
    wakeResolve = resolve;
    wakeTimer = setTimeout(() => { wakeTimer = null; wakeResolve = null; resolve(); }, ms);
  });

  async function processJob(job, creds) {
    const jobId = job.job_id || job.id;
    if (!jobId) throw new Error("Сервер вернул задание без ID.");
    state.lastJobId = jobId;
    state.lastJobAt = new Date().toISOString();
    state.message = "Выполняется задание " + jobId;
    try {
      const type = job.job_type || job.type;
      if (type !== "health_check") {
        throw new Error("Задание безопасно отклонено: в этой версии разрешён только health_check. AI-workflow ещё не подключён.");
      }
      const result = {
        provider: "qun-node-compute",
        health_check: true,
        nodeId: creds.nodeId,
        host: process.env.COMPUTERNAME || process.env.HOSTNAME || "QUN Node",
        platform: process.platform,
        architecture: process.arch,
        checkedAt: new Date().toISOString(),
        capabilities: { storage: true, computeQueue: true, comfyui: false },
        note: "Проверка очереди и вычислительного агента; генерация медиа пока не включена."
      };
      await api("complete_job", creds, { jobId, result });
      state.jobsCompleted += 1;
      state.lastError = null;
      state.message = "Задание " + jobId + " выполнено.";
    } catch (error) {
      const message = (error instanceof Error ? error.message : "Ошибка задания").slice(0, 1200);
      try { await api("fail_job", creds, { jobId, error: message }); } catch (reportError) {
        state.lastError = "Не удалось сообщить об ошибке задания: " + (reportError instanceof Error ? reportError.message : "API error");
      }
      state.jobsFailed += 1;
      if (!state.lastError) state.lastError = message;
      state.message = "Задание отклонено или завершилось ошибкой.";
    }
  }

  async function loop(creds) {
    while (running) {
      try {
        await api("node_heartbeat", creds);
        state.lastHeartbeatAt = new Date().toISOString();
        state.lastError = null;
        const response = await api("claim_job", creds);
        const job = response.job || null;
        if (job) await processJob(job, creds);
        else state.message = "Вычислительный узел онлайн; ожидает задания.";
      } catch (error) {
        state.lastError = error instanceof Error ? error.message : "Compute API error";
        state.message = "Ошибка связи с вычислительной очередью.";
      }
      if (running) await sleep(pollMs);
    }
  }

  async function start() {
    if (running) return snapshot();
    const creds = await credentials();
    state.nodeId = creds.nodeId;
    state.startedAt = new Date().toISOString();
    state.lastError = null;
    state.message = "Запускаем вычислительный модуль…";
    running = true;
    state.running = true;
    state.mode = "running";
    loopPromise = loop(creds).finally(() => {
      state.running = false;
      state.mode = "idle";
      loopPromise = null;
    });
    return snapshot();
  }

  async function stop() {
    running = false;
    if (wakeTimer) {
      clearTimeout(wakeTimer);
      wakeTimer = null;
      const resolve = wakeResolve;
      wakeResolve = null;
      if (resolve) resolve();
    }
    if (loopPromise) await Promise.race([loopPromise, new Promise(resolve => setTimeout(resolve, 3000))]);
    state.running = false;
    state.mode = "idle";
    state.message = "Вычисления остановлены. Основная нода продолжает работать.";
    return snapshot();
  }

  function snapshot() {
    return { ...state };
  }

  return { start, stop, snapshot };
}
