import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const db = createClient(
  "https://qdxjltqlnphvzafapncm.supabase.co",
  "sb_publishable_aCUwbGYj_kUU8nVUu1kWmQ_-d-8fp8L"
);
const BUCKET = "qun-studio-media";
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));
let session = null;
let currentUser = null;
let videoAssets = [];
let audioAssets = [];
let selectedVideoIds = [];
let busy = false;

function showAuth(nextSession) {
  session = nextSession || null;
  currentUser = session?.user || null;
  $("auth").hidden = Boolean(session);
  $("app").hidden = !session;
  if (session) loadLibrary();
}
function status(message, kind = "info") {
  $("status").textContent = message;
  $("status").dataset.kind = kind;
}
async function explainError(error) {
  let message = error?.message || "Запрос завершился ошибкой.";
  try {
    const body = await error.context.json();
    if (body?.error) message = body.error;
  } catch (_) {}
  return message;
}
function mimeAllowed(type) {
  return [
    "audio/mpeg", "audio/wav", "audio/x-wav", "audio/flac", "audio/ogg",
    "audio/aac", "audio/mp4", "audio/webm"
  ].includes(String(type || "").toLowerCase());
}
async function signedAsset(asset, seconds = 7200) {
  const bucket = asset.metadata?.storage_bucket || asset.storage_bucket;
  const path = asset.metadata?.storage_path || asset.storage_path;
  if (!bucket || !path) throw new Error("У выбранного материала нет пути к QUN Storage.");
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) throw new Error("Не удалось получить временную ссылку на файл из QUN Storage.");
  return {
    kind: asset.asset_type || asset.kind,
    storage_bucket: bucket,
    storage_path: path,
    signed_url: data.signedUrl,
    filename: asset.title || asset.filename || "QUN asset",
    asset_id: asset.id || asset.asset_id || null
  };
}
async function loadLibrary() {
  $("videoLibrary").innerHTML = '<p class="hint">Загружаем видео…</p>';
  $("musicSelect").innerHTML = '<option value="">Без музыки</option>';
  try {
    const { data, error } = await db.from("qun_studio_assets")
      .select("id,title,asset_type,provider,asset_url,preview_url,prompt,tags,metadata,created_at")
      .eq("created_by", currentUser.id)
      .eq("status", "ready")
      .in("asset_type", ["video", "audio"])
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error;
    const assets = data || [];
    const withPaths = assets.filter(a => a.metadata?.storage_bucket === BUCKET && a.metadata?.storage_path);
    videoAssets = withPaths.filter(a => a.asset_type === "video");
    audioAssets = withPaths.filter(a => a.asset_type === "audio");
    renderVideoLibrary();
    $("musicSelect").innerHTML = '<option value="">Без музыки</option>' +
      audioAssets.map(a => '<option value="' + esc(a.id) + '">' + esc(a.title) + '</option>').join("");
    $("libraryStatus").textContent = "Видео: " + videoAssets.length + " · аудио: " + audioAssets.length;
  } catch (error) {
    $("videoLibrary").innerHTML = '<p class="hint">Не удалось загрузить библиотеку: ' + esc(error.message) + "</p>";
    $("libraryStatus").textContent = error.message || "Ошибка библиотеки";
  }
}
function renderVideoLibrary() {
  const box = $("videoLibrary");
  if (!videoAssets.length) {
    box.innerHTML = '<p class="hint">В библиотеке пока нет видео. Все сцены будут созданы заново.</p>';
    return;
  }
  box.innerHTML = videoAssets.map(asset =>
    '<label class="asset-choice"><input type="checkbox" data-existing-video="' + esc(asset.id) + '">' +
    '<span><b>' + esc(asset.title) + '</b><small>' + esc(asset.provider || "QUN Library") + '</small></span></label>'
  ).join("");
  box.querySelectorAll("[data-existing-video]").forEach(input => {
    input.addEventListener("change", () => {
      const id = input.dataset.existingVideo;
      if (input.checked && !selectedVideoIds.includes(id)) selectedVideoIds.push(id);
      if (!input.checked) selectedVideoIds = selectedVideoIds.filter(x => x !== id);
      const count = Math.min(selectedVideoIds.length, Number($("sceneCount").value));
      $("existingCount").textContent = "Выбрано существующих фрагментов: " + count;
    });
  });
}
async function getOnlineGpuNode() {
  const { data, error } = await db.functions.invoke("qun-node-registry", {
    body: { action: "my_nodes" }
  });
  if (error) throw new Error(await explainError(error));
  if (data?.error) throw new Error(data.error);
  const online = (data?.nodes || []).filter(n =>
    n.platform === "linux-gpu" && n.status === "online"
  );
  return online[0] || null;
}
function parsePlan(raw, expectedCount) {
  const text = String(raw || "").trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("GigaChat не вернул JSON-сценарий. Попробуй ещё раз.");
  const parsed = JSON.parse(text.slice(first, last + 1));
  const scenes = Array.isArray(parsed.scenes) ? parsed.scenes.slice(0, expectedCount) : [];
  if (scenes.length !== expectedCount || scenes.some(scene => !String(scene.visual_prompt || "").trim())) {
    throw new Error("Сценарий должен содержать ровно " + expectedCount + " сцен с промптами.");
  }
  return {
    title: String(parsed.title || "Новый клип QUN").slice(0, 150),
    logline: String(parsed.logline || ""),
    visual_style: String(parsed.visual_style || ""),
    assembly_notes: String(parsed.assembly_notes || ""),
    scenes: scenes.map(scene => ({
      title: String(scene.title || "Сцена"),
      visual_prompt: String(scene.visual_prompt).trim()
    }))
  };
}
function renderPlan(film, existingCount, missingCount) {
  $("brief").innerHTML =
    '<h2>' + esc(film.title) + '</h2>' +
    '<p>' + esc(film.logline) + '</p>' +
    '<p class="hint">Стиль: ' + esc(film.visual_style) + '</p>' +
    film.scenes.map((scene, i) =>
      '<article class="scene"><b>Сцена ' + (i + 1) + ': ' + esc(scene.title) + '</b><p>' +
      esc(scene.visual_prompt) + '</p></article>'
    ).join("") +
    '<p class="hint">Существующих фрагментов: ' + existingCount + ' · новых сцен в очереди: ' + missingCount + '</p>';
  $("briefPanel").hidden = false;
}
async function createProject(film) {
  const { data: project, error } = await db.from("qun_studio_projects").insert({
    slug: "qun-masterpiece-" + crypto.randomUUID(),
    title: film.title.slice(0, 160),
    description: film.logline || "Автоматический клип QUN Masterpiece",
    status: "active",
    created_by: currentUser.id,
    metadata: {
      source: "QUN Masterpiece One-Click",
      language: "ru",
      scene_count: film.scenes.length,
      gpu_owner_scoped: true,
      audio_repeat_to_track: true
    }
  }).select("id").single();
  if (error || !project?.id) throw new Error("Не удалось создать проект в QUN Library: " + (error?.message || "нет project id"));
  return project.id;
}
async function createVideoJob(projectId, film, scene, sceneIndex) {
  const { data, error } = await db.functions.invoke("qun-compute", {
    body: {
      action: "create_job",
      projectId,
      title: (film.title + " — сцена " + (sceneIndex + 1)).slice(0, 150),
      prompt: scene.visual_prompt,
      jobType: "video_generation",
      requirements: {
        engine: "comfyui",
        requested_output: "video",
        workflow_key: "video",
        production: {
          title: film.title,
          scene_index: sceneIndex + 1,
          scene_count: film.scenes.length,
          visual_style: film.visual_style,
          logline: film.logline,
          continuity: "Match the same character design, palette, lighting and cinematic language across all scenes."
        }
      }
    }
  });
  if (error) throw new Error(await explainError(error));
  if (data?.error || !data?.job?.job_id) throw new Error(data?.error || "QUN Compute не вернул ID задачи.");
  return { id: data.job.job_id, sceneIndex, scene, retryCount: 0 };
}
async function getMyJobs() {
  const { data, error } = await db.functions.invoke("qun-compute", { body: { action: "my_jobs" } });
  if (error) throw new Error(await explainError(error));
  if (data?.error) throw new Error(data.error);
  return data?.jobs || [];
}
async function waitForScenes(initialJobs, film, projectId) {
  let jobs = initialJobs.slice();
  let cycle = 0;
  const startedAt = Date.now();
  while (true) {
    if (Date.now() - startedAt > 4 * 60 * 60 * 1000) {
      throw new Error("Ожидание GPU превысило 4 часа. Задания остаются в QUN Compute; можно открыть Director и обновить статус позже.");
    }
    const current = await getMyJobs();
    const replacements = [];
    for (const task of jobs) {
      const row = current.find(j => j.job_id === task.id);
      task.row = row || task.row;
      if (row?.status === "failed" && task.retryCount < 1) {
        task.retryCount++;
        status("Сцена " + (task.sceneIndex + 1) + " завершилась ошибкой. Автоматически ставим одну повторную попытку…");
        const replacement = await createVideoJob(projectId, film, task.scene, task.sceneIndex);
        replacement.retryCount = task.retryCount;
        replacements.push({ oldId: task.id, task: replacement });
      }
    }
    for (const replacement of replacements) {
      jobs = jobs.filter(x => x.id !== replacement.oldId);
      jobs.push(replacement.task);
    }
    const rows = jobs.map(task => task.row || current.find(j => j.job_id === task.id)).filter(Boolean);
    const succeeded = rows.filter(j => j.status === "succeeded").length;
    const failed = jobs.filter(task => (task.row || current.find(j => j.job_id === task.id))?.status === "failed");
    status("QUN Compute · готово " + succeeded + "/" + jobs.length +
      " · в очереди/работе " + Math.max(0, jobs.length - succeeded - failed.length) +
      " · проверка " + (++cycle) + ". Можно оставить страницу открытой.");
    if (failed.length) {
      const details = failed.map(task => "Сцена " + (task.sceneIndex + 1) + ": " + (task.row?.error_message || "ошибка генерации")).join("\n");
      throw new Error("Не удалось создать некоторые сцены после повтора:\n" + details);
    }
    if (succeeded === jobs.length) return jobs;
    await new Promise(resolve => setTimeout(resolve, 8000));
  }
}
async function refreshSignedAsset(asset) {
  const { data, error } = await db.storage.from(asset.metadata.storage_bucket)
    .createSignedUrl(asset.metadata.storage_path, 2 * 60 * 60);
  if (error || !data?.signedUrl) throw new Error("Не удалось обновить ссылку на материал «" + asset.title + "».");
  return {
    kind: asset.asset_type,
    storage_bucket: asset.metadata.storage_bucket,
    storage_path: asset.metadata.storage_path,
    signed_url: data.signedUrl,
    filename: asset.title,
    asset_id: asset.id
  };
}
async function getAudioTrack() {
  const localFile = $("audioFile").files?.[0];
  if (localFile) {
    if (!mimeAllowed(localFile.type)) throw new Error("Формат аудио не поддерживается. Используй MP3, WAV, FLAC, OGG, AAC или M4A.");
    if (localFile.size > 100 * 1024 * 1024) throw new Error("Музыкальный файл превышает лимит 100 МБ.");
    status("Загружаем музыкальный файл в твою приватную QUN Library…");
    const ext = localFile.name.includes(".") ? localFile.name.split(".").pop().toLowerCase() : "mp3";
    const path = currentUser.id + "/" + crypto.randomUUID() + "." + ext;
    const { error: uploadError } = await db.storage.from(BUCKET).upload(path, localFile, {
      contentType: localFile.type, cacheControl: "3600", upsert: false
    });
    if (uploadError) throw new Error("Не удалось загрузить музыку в QUN Storage: " + uploadError.message);
    const { data: asset, error: assetError } = await db.from("qun_studio_assets").insert({
      title: localFile.name.slice(0, 160),
      asset_type: "audio",
      provider: "qun-user-upload",
      asset_url: null,
      preview_url: null,
      prompt: "Музыкальная дорожка пользователя для QUN Masterpiece.",
      status: "ready",
      tags: ["QUN", "Soundtrack", "User Upload"],
      created_by: currentUser.id,
      metadata: {
        storage_bucket: BUCKET,
        storage_path: path,
        content_type: localFile.type,
        size_bytes: localFile.size,
        source: "QUN Director local upload"
      }
    }).select("id,title,metadata,asset_type").single();
    if (assetError || !asset) throw new Error("Музыка сохранена, но запись библиотеки не создана: " + (assetError?.message || ""));
    return refreshSignedAsset(asset);
  }
  const id = $("musicSelect").value;
  if (!id) return null;
  const asset = audioAssets.find(a => a.id === id);
  if (!asset) throw new Error("Выбранный аудиофайл отсутствует в библиотеке.");
  return refreshSignedAsset(asset);
}
async function pollAssembly(jobId, title) {
  const startedAt = Date.now();
  while (true) {
    if (Date.now() - startedAt > 60 * 60 * 1000) throw new Error("Финальная сборка ещё выполняется. Проверь статус в QUN Compute позже.");
    const jobs = await getMyJobs();
    const row = jobs.find(j => j.job_id === jobId);
    if (!row) throw new Error("Задача финальной сборки не найдена в QUN Compute.");
    if (row.status === "failed") throw new Error("Финальная сборка завершилась ошибкой: " + (row.error_message || "FFmpeg error"));
    if (row.status === "succeeded") {
      const output = (row.result?.outputs || []).find(x => x.kind === "video" && x.signed_url);
      if (!output) throw new Error("Сборка помечена завершённой, но файл не зарегистрирован в QUN Library.");
      return output;
    }
    status("Финальная сборка «" + title + "» · " + ({
      queued: "в очереди", running: "FFmpeg собирает фильм…"
    }[row.status] || row.status));
    await new Promise(resolve => setTimeout(resolve, 8000));
  }
}
async function runMasterpiece() {
  if (busy) return;
  const idea = $("idea").value.trim();
  if (idea.length < 4) { status("Сначала опиши идею клипа.", "error"); return; }
  const sceneCount = Number($("sceneCount").value);
  const chosen = selectedVideoIds.map(id => videoAssets.find(a => a.id === id)).filter(Boolean).slice(0, sceneCount);
  const missingCount = Math.max(0, sceneCount - chosen.length);
  busy = true;
  $("createWhole").disabled = true;
  $("createWhole").textContent = "Режиссируем…";
  $("result").innerHTML = "";
  $("briefPanel").hidden = true;
  try {
    status("Проверяем твой QUN GPU-узел…");
    const node = await getOnlineGpuNode();
    if (!node) {
      throw new Error("Твой GPU Render Node сейчас не в сети. Сначала подключи его на странице «GPU Render Node», затем нажми «Создать клип целиком» снова.");
    }

    const audio = await getAudioTrack();
    const fullIdea = [
      idea,
      audio ? "Музыкальная дорожка: " + audio.filename + ". Ритм и настроение клипа должны соответствовать этой музыке." : "Музыка не выбрана; создай немой видеоряд.",
      "Создай целостный кинематографический клип с непрерывным визуальным стилем."
    ].join("\n\n");

    status("GigaChat разрабатывает сценарий из " + sceneCount + " сцен…");
    const { data: planData, error: planError } = await db.functions.invoke("qun-gigachat-director", {
      body: { task: "film_plan", idea: fullIdea, scene_count: sceneCount }
    });
    if (planError) throw new Error(await explainError(planError));
    if (planData?.error) throw new Error(planData.error);
    const film = parsePlan(planData?.result, sceneCount);
    renderPlan(film, chosen.length, missingCount);

    status("Создаём проект и ставим " + missingCount + " недостающих сцен в очередь…");
    const projectId = await createProject(film);
    const jobs = [];
    for (let index = chosen.length; index < film.scenes.length; index++) {
      jobs.push(await createVideoJob(projectId, film, film.scenes[index], index));
      status("В QUN Compute добавлено " + jobs.length + "/" + missingCount + " новых сцен…");
    }

    let completedJobs = [];
    if (jobs.length) completedJobs = await waitForScenes(jobs, film, projectId);

    const videoOutputs = [];
    for (const asset of chosen) videoOutputs.push(await refreshSignedAsset(asset));
    const completedByScene = new Map(completedJobs.map(task => [task.sceneIndex, task.row || null]));
    for (let index = chosen.length; index < film.scenes.length; index++) {
      const task = completedJobs.find(x => x.sceneIndex === index);
      const row = task?.row || (await getMyJobs()).find(j => j.job_id === task?.id);
      const output = (row?.result?.outputs || []).find(x => x.kind === "video" && x.storage_bucket && x.storage_path);
      if (!output) throw new Error("Сцена " + (index + 1) + " завершилась без видеофайла в QUN Storage.");
      const { data: signed, error } = await db.storage.from(output.storage_bucket).createSignedUrl(output.storage_path, 2 * 60 * 60);
      if (error || !signed?.signedUrl) throw new Error("Не удалось получить готовую сцену " + (index + 1) + " из QUN Storage.");
      videoOutputs.push({
        kind: "video",
        storage_bucket: output.storage_bucket,
        storage_path: output.storage_path,
        signed_url: signed.signedUrl,
        filename: output.filename || "scene-" + (index + 1),
        asset_id: output.asset_id
      });
    }
    if (!videoOutputs.length) throw new Error("Нет видеофрагментов для финальной сборки.");

    status("Все сцены готовы. Создаём задачу финального монтажа" + (audio ? " и полной музыкальной дорожки…" : "…"));
    const requirements = {
      operation: "assemble_video",
      video_outputs: videoOutputs,
      repeat_video_to_audio: Boolean(audio),
    };
    if (audio) requirements.audio_output = audio;

    const { data: assemblyData, error: assemblyError } = await db.functions.invoke("qun-compute", {
      body: {
        action: "create_job",
        projectId,
        title: (film.title + " — финальный фильм").slice(0, 150),
        prompt: "Нормализовать все сцены по формату, последовательно склеить, добавить полную музыкальную дорожку и сохранить MP4 в приватную QUN Library.",
        jobType: "comfyui_workflow",
        requirements
      }
    });
    if (assemblyError) throw new Error(await explainError(assemblyError));
    if (assemblyData?.error || !assemblyData?.job?.job_id) throw new Error(assemblyData?.error || "Не удалось создать задачу финальной сборки.");
    const finalOutput = await pollAssembly(assemblyData.job.job_id, film.title);
    $("result").innerHTML =
      '<video controls playsinline preload="metadata" src="' + esc(finalOutput.signed_url) + '"></video>' +
      '<div class="row"><a class="button" href="' + esc(finalOutput.signed_url) + '" target="_blank" rel="noopener">Скачать MP4 ↓</a>' +
      '<a class="button secondary" href="./index.html">Открыть QUN Library ↗</a></div>';
    status("Готово! «" + film.title + "» собран, музыка " + (audio ? "продлена до конца трека" : "не добавлялась") + ", итоговый MP4 сохранён в твоей QUN Library.", "success");
  } catch (error) {
    status("Не удалось завершить автоматический клип: " + (error.message || String(error)), "error");
  } finally {
    busy = false;
    $("createWhole").disabled = false;
    $("createWhole").textContent = "✦ Создать клип целиком";
  }
}
$("createWhole").addEventListener("click", runMasterpiece);
$("refreshLibrary").addEventListener("click", loadLibrary);
$("sceneCount").addEventListener("change", () => {
  selectedVideoIds = selectedVideoIds.slice(0, Number($("sceneCount").value));
  loadLibrary();
  $("existingCount").textContent = "Выбрано существующих фрагментов: " + selectedVideoIds.length;
});
$("login").addEventListener("click", async () => {
  const button = $("login");
  button.disabled = true;
  $("authstatus").textContent = "Подключаем QUN ID…";
  try {
    await QUNAuth.login(db, $("loginIdentifier").value, $("password").value);
    $("authstatus").textContent = "Вход выполнен.";
  } catch (error) {
    $("authstatus").textContent = error.message || "Не удалось войти.";
  } finally {
    button.disabled = false;
  }
});
$("signup").addEventListener("click", async () => {
  const button = $("signup");
  button.disabled = true;
  $("authstatus").textContent = "Создаём QUN ID…";
  try {
    const login = QUNAuth.cleanLogin($("loginIdentifier").value);
    await QUNAuth.register(db, { username: login, display_name: login, password: $("password").value });
    $("authstatus").textContent = "QUN ID создан.";
  } catch (error) {
    $("authstatus").textContent = error.message || "Не удалось создать QUN ID.";
  } finally {
    button.disabled = false;
  }
});
$("signout").addEventListener("click", async () => { await db.auth.signOut(); showAuth(null); });
const { data: { session: existingSession } } = await db.auth.getSession();
showAuth(existingSession);
db.auth.onAuthStateChange((_event, newSession) => showAuth(newSession));
