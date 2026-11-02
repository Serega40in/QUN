import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const SUPABASE_URL = "https://qdxjltqlnphvzafapncm.supabase.co";
const SUPABASE_KEY = "sb_publishable_aCUwbGYj_kUU8nVUu1kWmQ_-d-8fp8L";
const db = createClient(SUPABASE_URL, SUPABASE_KEY);
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
    '<label class="asset-choice"><input type="checkbox" data-existing-video="' + esc(asset.id) + '"' +
    (selectedVideoIds.includes(asset.id) ? " checked" : "") + '>' +
    '<span><b>' + esc(asset.title) + '</b><small>' + esc(asset.provider || "QUN Library") + '</small></span></label>'
  ).join("");
  box.querySelectorAll("[data-existing-video]").forEach(input => {
    input.addEventListener("change", () => {
      const id = input.dataset.existingVideo;
      if (input.checked && !selectedVideoIds.includes(id)) selectedVideoIds.push(id);
      if (!input.checked) selectedVideoIds = selectedVideoIds.filter(x => x !== id);
      const count = Math.min(selectedVideoIds.length, Number($("sceneCount").value));
      $("existingCount").textContent = "Выбрано существующих фрагментов: " + count;
      updateResourceEstimate();
    });
  });
}
async function getOnlineGpuNode() {
  let response;
  try {
    response = await db.functions.invoke("qun-node-registry", {
      body: { action: "my_nodes" }
    });
  } catch (error) {
    throw new Error("Не удалось связаться с QUN Node Registry. Проверь соединение с Supabase. Подробности: " + (error?.message || String(error)));
  }
  const { data, error } = response;
  if (error) throw new Error("QUN Node Registry: " + await explainError(error));
  if (data?.error) throw new Error("QUN Node Registry: " + data.error);
  const online = (data?.nodes || []).filter(n =>
    n.platform === "linux-gpu" && n.status === "online"
  );
  return online[0] || null;
}
async function getOnlineWindowsCpuNode() {
  const { data, error } = await db.functions.invoke("qun-node-registry", { body: { action: "my_nodes" } });
  if (error) throw new Error("Не удалось проверить Windows CPU-узлы QUN: " + await explainError(error));
  if (data?.error) throw new Error("QUN Node Registry: " + data.error);
  return (data?.nodes || []).find(n => n.platform === "windows-cpu" && n.status === "online") || null;
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
async function createProject(film, gigachatUsage = null) {
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
      gigachat_usage: gigachatUsage,
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
    if (localFile.size > 45 * 1024 * 1024) throw new Error("Музыкальный файл превышает безопасный лимит QUN Storage 45 MiB.");
    status("Проверяем, не загружалась ли эта композиция раньше…");
    const bytes = await localFile.arrayBuffer();
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map(v => v.toString(16).padStart(2, "0")).join("");
    const { data: duplicate, error: duplicateError } = await db.from("qun_studio_assets")
      .select("id,title,metadata,asset_type")
      .eq("created_by", currentUser.id).eq("asset_type", "audio")
      .contains("metadata", { sha256 }).limit(1).maybeSingle();
    if (duplicateError) throw new Error("Не удалось проверить повторы музыки: " + duplicateError.message);
    if (duplicate) {
      status("Такая композиция уже есть в QUN Library. Используем существующую копию — повторной загрузки не будет.");
      return refreshSignedAsset(duplicate);
    }
    const legacyCandidates = audioAssets
      .filter(asset => !asset.metadata?.sha256 && Number(asset.metadata?.size_bytes || 0) === localFile.size &&
        asset.metadata?.storage_bucket === BUCKET && asset.metadata?.storage_path)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(0, 10);
    for (const candidate of legacyCandidates) {
      const existingSigned = await refreshSignedAsset(candidate);
      const existingResponse = await fetch(existingSigned.signed_url);
      if (!existingResponse.ok) continue;
      const existingBytes = await existingResponse.arrayBuffer();
      const existingHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", existingBytes)))
        .map(v => v.toString(16).padStart(2, "0")).join("");
      if (existingHash !== sha256) continue;
      const updatedMetadata = { ...(candidate.metadata || {}), sha256: existingHash };
      await db.from("qun_studio_assets").update({ metadata: updatedMetadata })
        .eq("id", candidate.id).eq("created_by", currentUser.id);
      status("Совпадение найдено среди старых загрузок. Используем существующую композицию; второй файл не создаём.");
      return existingSigned;
    }
    status("Сохраняем новую композицию в QUN Library…");
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
        sha256,
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
function hashSeed(value) {
  let h = 2166136261;
  for (const ch of String(value || "")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function sceneColors(prompt, index) {
  const p = String(prompt || "").toLowerCase();
  if (/(forest|tree|leaf|jungle|garden|meadow|nature|лес|дерев|лесн|природ|трава)/i.test(p))
    return ["#061a20", "#0d4a45", "#5b9b72", "#d6c783"];
  if (/(sea|ocean|water|river|wave|rain|lake|underwater|море|океан|вода|река|волна|дожд|озер)/i.test(p))
    return ["#06162a", "#0c3d62", "#237e91", "#a6e1d3"];
  if (/(space|cosmos|star|galaxy|planet|moon|universe|звезд|космос|планет|луна|вселен)/i.test(p))
    return ["#090d25", "#26285d", "#5966a8", "#e5c98d"];
  if (/(city|street|building|architecture|urban|город|улиц|здан|архитект)/i.test(p))
    return ["#071624", "#17465a", "#388d89", "#e9c57e"];
  if (/(sun|sunset|dawn|fire|gold|light|warm|солнц|закат|рассвет|огонь|золот|свет)/i.test(p))
    return ["#21112b", "#713e48", "#d18b5a", "#f5d996"];
  const palettes = [
    ["#061421", "#124c50", "#367f75", "#e5c987"],
    ["#09172b", "#204465", "#477f9b", "#d5d9b2"],
    ["#101329", "#3a315e", "#76679b", "#e3c991"],
    ["#0b1b21", "#1c5c53", "#4e9c83", "#eacb83"]
  ];
  return palettes[index % palettes.length];
}
async function createQunKeyframe(film, scene, sceneIndex) {
  const canvas = document.createElement("canvas");
  canvas.width = 832;
  canvas.height = 480;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Браузер не создал локальный холст для стартового кадра.");
  const prompt = scene.visual_prompt + " " + film.visual_style;
  const colors = sceneColors(prompt, sceneIndex);
  let seed = hashSeed(prompt + ":" + sceneIndex);
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const w = canvas.width, h = canvas.height;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, colors[0]); sky.addColorStop(.52, colors[1]); sky.addColorStop(1, colors[2]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

  const glowX = w * (.34 + .32 * random());
  const glowY = h * (.22 + .18 * random());
  const glow = ctx.createRadialGradient(glowX, glowY, 2, glowX, glowY, h * .52);
  glow.addColorStop(0, colors[3] + "cc");
  glow.addColorStop(.22, colors[3] + "55");
  glow.addColorStop(1, colors[3] + "00");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = .68;
  for (let i = 0; i < 125; i++) {
    const x = random() * w, y = random() * h * .68;
    const r = .35 + random() * 1.6;
    ctx.fillStyle = i % 7 === 0 ? colors[3] : "#e4f7ed";
    ctx.globalAlpha = .15 + random() * .65;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  const horizon = h * (.62 + .08 * random());
  function ridge(base, amplitude, color, phase) {
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const y = base + Math.sin(x * .009 + phase) * amplitude
        + Math.sin(x * .021 + phase * 1.7) * amplitude * .28
        + Math.sin(x * .003 + phase * .7) * amplitude * .65;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
  }
  ridge(horizon - 48, 36, colors[1], random() * 6);
  ridge(horizon - 8, 26, colors[2], random() * 6);
  ridge(horizon + 34, 16, "#071a24", random() * 6);

  // A luminous QUN-like geometric core, intentionally free of lettering.
  const cx = glowX, cy = glowY + 12, radius = 54 + random() * 28;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((random() - .5) * .22);
  ctx.shadowColor = colors[3]; ctx.shadowBlur = 34;
  ctx.strokeStyle = colors[3]; ctx.lineWidth = 2.2; ctx.globalAlpha = .88;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 4;
    const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
    if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.stroke();
  ctx.globalAlpha = .55; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.arc(0, 0, radius * 1.42, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, radius * 1.8, radius * .56, -.55, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, radius * .38, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = .2;
  ctx.strokeStyle = colors[3]; ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const y = horizon + i * 17;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * .25, y - 8, w * .7, y + 10, w, y - 4); ctx.stroke();
  }
  ctx.restore();
  const vignette = ctx.createRadialGradient(w/2, h/2, h*.18, w/2, h/2, h*.78);
  vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(1, "rgba(0,5,13,.48)");
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);

  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Не удалось создать PNG стартового кадра.")), "image/png"));
  return new File([blob], "QUN-scene-" + (sceneIndex + 1) + ".png", { type: "image/png" });
}
async function generateWanScene(projectId, film, scene, sceneIndex) {
  const image = await createQunKeyframe(film, scene, sceneIndex);
  const form = new FormData();
  form.append("image", image, image.name);
  form.append("prompt", [
    scene.visual_prompt,
    "Cinematic 5-second shot, natural continuous motion, elegant camera movement, coherent lighting, premium visual quality.",
    "Maintain the visual palette and atmosphere: " + film.visual_style + ".",
    "No text, no subtitles, no logos, no watermark."
  ].join(" "));
  form.append("duration", "5");
  form.append("steps", "4");
  form.append("public_zero_gpu", "true");
  form.append("project_id", projectId);

  const { data: authData } = await db.auth.getSession();
  const accessToken = authData?.session?.access_token;
  if (!accessToken) throw new Error("Сессия QUN завершилась. Войди снова.");
  const response = await fetch(SUPABASE_URL + "/functions/v1/qun-studio-video", {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + accessToken },
    body: form
  });
  let result;
  try { result = await response.json(); }
  catch (_) { throw new Error("QUN Wan 2.2 вернул нечитаемый ответ (HTTP " + response.status + ")."); }
  if (!response.ok || !result?.ok || !result?.asset?.id) {
    throw new Error(result?.error || ("QUN Wan 2.2: HTTP " + response.status));
  }
  return result.asset;
}
async function runZeroGpuFallback(projectId, film, chosen) {
  const missingCount = Math.max(0, film.scenes.length - chosen.length);
  if (missingCount > 2) {
    throw new Error("Без собственного GPU Render Node бесплатный ZeroGPU-режим создаёт не более двух новых сцен за запуск. Выбери 2 сцены или подключи свой GPU-узел.");
  }
  const generated = [];
  for (let index = chosen.length; index < film.scenes.length; index++) {
    const scene = film.scenes[index];
    status("Wan 2.2 ZeroGPU · создаём сцену " + (index + 1) + "/" + film.scenes.length + " · 5 секунд · бесплатный анонимный режим…");
    try {
      const generationStartedAt = performance.now();
      const asset = await generateWanScene(projectId, film, scene, index);
      asset._qunUsage = { provider: "huggingface-wan2.2", requested_seconds: 5, elapsed_ms: Math.max(0, Math.round(performance.now() - generationStartedAt)), steps: 4 };
      generated.push(asset);
      status("Готова сцена " + (index + 1) + " · " + generated.length + " новых видео сохранено в QUN Library.");
    } catch (error) {
      if (!chosen.length && !generated.length) throw error;
      status("Одна из сцен не создалась: " + (error.message || String(error)) + ". Собираем фильм из уже готовых фрагментов.");
      break;
    }
  }
  return generated;
}
function openMastercutForAssembly(projectId, film, chosen, generated, audio, warning = "") {
  const ids = [...chosen.map(x => x.id), ...generated.map(x => x.id)].filter(Boolean);
  if (!ids.length) throw new Error("Нет готовых видеосцен для монтажа.");
  const params = new URLSearchParams({
    auto: "1",
    ids: ids.join(","),
    title: film.title,
    repeat: audio ? "yes" : "no",
    autobuild: "1",
    project: projectId,
    music_duration: $("musicDuration")?.value || "10",
    ai_scenes: String(generated.length),
    ai_generation_ms: String(generated.reduce((sum, asset) => sum + Number(asset._qunUsage?.elapsed_ms || 0), 0))
  });
  if (audio?.asset_id) params.set("audio", audio.asset_id);
  if (warning) params.set("notice", warning.slice(0, 240));
  status("Видео готовы. Передаём сцены в QUN Mastercut для автоматической сборки…", "success");
  window.location.assign("./mastercut.html?" + params.toString());
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
async function assembleWithWindowsCpu(projectId, film, chosen, generated, audio) {
  const videoOutputs = [];
  for (const asset of [...chosen, ...generated]) videoOutputs.push(await refreshSignedAsset(asset));
  if (!videoOutputs.length) throw new Error("Для CPU-монтажа нужна хотя бы одна готовая видеосцена.");
  const requirements = {
    operation: "assemble_video",
    video_outputs: videoOutputs,
    repeat_video_to_audio: Boolean(audio)
  };
  if (audio) {
    requirements.audio_output = audio;
    const musicDuration = $("musicDuration")?.value || "10";
    if (musicDuration !== "full") requirements.music_duration_seconds = Number(musicDuration);
  }
  status("QUN Windows CPU Node · передаём сцены в свою очередь FFmpeg…", "success");
  const { data, error } = await db.functions.invoke("qun-compute", {
    body: {
      action: "create_job",
      projectId,
      title: (film.title + " — QUN CPU монтаж").slice(0, 150),
      prompt: "Собрать выбранные сцены локальным FFmpeg на личном Windows CPU-узле и сохранить MP4 в приватную QUN Library.",
      jobType: "comfyui_workflow",
      requirements
    }
  });
  if (error) throw new Error(await explainError(error));
  if (data?.error || !data?.job?.job_id) throw new Error(data?.error || "Не удалось создать задачу QUN CPU-монтажа.");
  const output = await pollAssembly(data.job.job_id, film.title);
  $("result").innerHTML =
    '<video controls playsinline preload="metadata" src="' + esc(output.signed_url) + '"></video>' +
    '<div class="row"><a class="button" href="' + esc(output.signed_url) + '" target="_blank" rel="noopener">Скачать MP4 ↓</a>' +
    '<a class="button secondary" href="./index.html">Открыть QUN Library ↗</a></div>';
  status("Готово! «" + film.title + "» собран на собственном Windows CPU-узле и сохранён в QUN Library · " +
    videoOutputs.length + " сцен" + (audio ? " · музыка до " + (requirements.music_duration_seconds || "конца трека") + " сек." : " · без музыки") + ".", "success");
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
    if (!node && missingCount > 2) {
      throw new Error("Для двух бесплатных AI-сцен без собственного GPU Render Node выбери 2 сцены. Для 4–12 сцен подключи свой GPU-узел или выбери готовые фрагменты из QUN Library.");
    }

    const audio = await getAudioTrack();
    const fullIdea = [
      idea,
      audio ? "Музыкальная дорожка: " + audio.filename + ". Ритм и настроение клипа должны соответствовать этой музыке." : "Музыка не выбрана; создай немой видеоряд.",
      "Создай целостный кинематографический клип с непрерывным визуальным стилем."
    ].join("\n\n");

    status("GigaChat разрабатывает сценарий из " + sceneCount + " сцен…");
    let planResponse;
    try {
      planResponse = await db.functions.invoke("qun-gigachat-director", {
        body: { task: "film_plan", idea: fullIdea, scene_count: sceneCount }
      });
    } catch (error) {
      throw new Error("Не удалось связаться с QUN Director / GigaChat. Подробности: " + (error?.message || String(error)));
    }
    const { data: planData, error: planError } = planResponse;
    if (planError) throw new Error("QUN Director / GigaChat: " + await explainError(planError));
    if (planData?.error) throw new Error("QUN Director / GigaChat: " + planData.error);
    const film = parsePlan(planData?.result, sceneCount);
    const gigachatUsage = planData?.usage && typeof planData.usage === "object" ? {
      prompt_tokens: Number(planData.usage.prompt_tokens || 0),
      completion_tokens: Number(planData.usage.completion_tokens || 0),
      precached_prompt_tokens: Number(planData.usage.precached_prompt_tokens || 0),
      total_tokens: Number(planData.usage.total_tokens || 0)
    } : null;
    if (gigachatUsage) {
      $("resourceEstimate").textContent = $("resourceEstimate").textContent +
        " Факт GigaChat: " + gigachatUsage.total_tokens + " тарифицируемых токенов (" +
        gigachatUsage.prompt_tokens + " входных, " + gigachatUsage.completion_tokens + " выходных).";
    }
    renderPlan(film, chosen.length, missingCount);

    status("Создаём проект и ставим " + missingCount + " недостающих сцен в очередь…");
    const projectId = await createProject(film, gigachatUsage);
    if (!node) {
      const generated = await runZeroGpuFallback(projectId, film, chosen);
      const cpuNode = await getOnlineWindowsCpuNode();
      if (cpuNode) {
        await assembleWithWindowsCpu(projectId, film, chosen, generated, audio);
        return;
      }
      const warning = generated.length + chosen.length < film.scenes.length
        ? "Часть сцен не удалось получить из внешней бесплатной ZeroGPU-очереди. Фильм собран из готовых сцен."
        : "Для сборки без браузера подключи личный Windows CPU Node; сейчас используется монтаж в браузере.";
      openMastercutForAssembly(projectId, film, chosen, generated, audio, warning);
      return;
    }

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
function updateResourceEstimate() {
  const requested = Number($("sceneCount").value || 2);
  const available = selectedVideoIds.length;
  const needed = Math.max(0, requested - available);
  const music = $("musicSelect").value || $("audioFile").files?.[0]?.name;
  const musicDuration = $("musicDuration").value;
  const musicLabel = musicDuration === "full" ? "весь выбранный трек" : musicDuration + " сек.";
  $("resourceEstimate").textContent =
    "QUN Resource Meter · предварительно: " + needed + " новых AI-сцен" +
    (needed <= 2 ? " × 5 сек. = до " + (needed * 5) + " сек. видеогенерации в ZeroGPU" : " · для этого объёма нужен собственный GPU Render Node") +
    "; готовые сцены: " + available + "; музыка: " + (music ? musicLabel + " из готового файла" : "не выбрана") +
    ". Сценарий — 1 запрос GigaChat; монтаж — в браузере. Пока это измеритель операций, не списание токенов.";
}
$("createWhole").addEventListener("click", runMasterpiece);
$("refreshLibrary").addEventListener("click", loadLibrary);
$("sceneCount").addEventListener("change", () => {
  selectedVideoIds = selectedVideoIds.slice(0, Number($("sceneCount").value));
  loadLibrary();
  $("existingCount").textContent = "Выбрано существующих фрагментов: " + selectedVideoIds.length;
  updateResourceEstimate();
});
$("musicDuration").addEventListener("change", updateResourceEstimate);
$("musicSelect").addEventListener("change", updateResourceEstimate);
$("audioFile").addEventListener("change", updateResourceEstimate);
updateResourceEstimate();
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
