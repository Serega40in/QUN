import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
const HF_SPACE = "https://zerogpu-aoti-wan2-2-fp8da-aoti-faster.hf.space";
const BUCKET = "qun-studio-media";
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, authorization, x-client-info",
  "Vary": "Origin",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const sha256 = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map(v => v.toString(16).padStart(2, "0")).join("");
function outputUrl(v: any): string | null {
  if (typeof v === "string" && /^https?:\/\//i.test(v)) return v;
  if (!v || typeof v !== "object") return null;
  for (const x of [v.url, v.video?.url, v.video, v.path, v.video?.path]) {
    if (typeof x === "string" && x) {
      if (/^https?:\/\//i.test(x)) return x;
      if (x.startsWith("/")) return new URL(x, HF_SPACE).toString();
    }
  }
  return null;
}
async function readSSE(response: Response): Promise<any[]> {
  const text = await response.text();
  const blocks = text.split(/\r?\n\r?\n/);
  for (const block of blocks.reverse()) {
    const event = block.match(/^event:\s*(\w+)/m)?.[1];
    const data = block.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n");
    if (event === "error") throw new Error("Hugging Face вернул ошибку генерации: " + data.slice(0, 500));
    if ((event === "complete" || event === "generating") && data) {
      try { const parsed = JSON.parse(data); if (Array.isArray(parsed)) return parsed; } catch { /* next SSE block */ }
    }
  }
  throw new Error("Space не вернул завершённый результат. Попробуй короткий ролик позже.");
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Войди в QUN, чтобы создавать и сохранять видео." }, 401);
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "Сессия QUN недействительна. Войди снова." }, 401);
    const form = await req.formData();
    const image = form.get("image");
    const prompt = String(form.get("prompt") || "").trim().slice(0, 2000);
    const duration = Number(form.get("duration") || 2);
    const steps = Number(form.get("steps") || 4);
    const publicZeroGpu = form.get("public_zero_gpu") === "true";
    const projectId = String(form.get("project_id") || "").trim();
    if (!(image instanceof File) || !image.type.startsWith("image/")) return json({ error: "Загрузи изображение PNG/JPEG/WebP." }, 400);
    if (image.size > 12 * 1024 * 1024) return json({ error: "Изображение больше 12 МБ. Уменьши размер и повтори." }, 413);
    if (!prompt) return json({ error: "Добавь описание движения." }, 400);
    if (![2, 3.5, 5].includes(duration) || ![4, 6, 8].includes(steps)) return json({ error: "Недопустимые настройки генерации." }, 400);

    if (projectId) {
      const { data: project, error: projectError } = await db.from("qun_studio_projects")
        .select("id").eq("id", projectId).eq("created_by", auth.user.id).maybeSingle();
      if (projectError || !project) return json({ error: "Проект QUN не найден или принадлежит другому аккаунту." }, 403);
    }

    // Director's no-cost mode deliberately omits HF_TOKEN. This uses the public
    // anonymous ZeroGPU pool and cannot consume a user's prepaid HF credits.
    if (publicZeroGpu) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error: quotaError } = await db.from("qun_studio_assets")
        .select("id", { count: "exact", head: true })
        .eq("created_by", auth.user.id)
        .eq("provider", "huggingface-wan2.2")
        .contains("metadata", { zero_gpu_auth_mode: "anonymous" })
        .gte("created_at", since);
      if (quotaError) return json({ error: "Не удалось проверить дневной лимит QUN ZeroGPU." }, 500);
      if ((count || 0) >= 2) return json({
        error: "Достигнут безопасный лимит QUN: две бесплатные ZeroGPU-сцены за 24 часа. Новые сцены можно создать после обновления лимита."
      }, 429);
    }

    const hfToken = publicZeroGpu ? "" : Deno.env.get("HF_TOKEN");
    const uploadForm = new FormData();
    uploadForm.append("files", image, image.name || "qun-source.png");
    const uploadResponse = await fetch(HF_SPACE + "/gradio_api/upload", {
      method: "POST", headers: hfToken ? { Authorization: "Bearer " + hfToken } : {}, body: uploadForm,
    });
    if (!uploadResponse.ok) throw new Error("Не удалось передать изображение генератору (HTTP " + uploadResponse.status + ").");
    const uploadResult = await uploadResponse.json();
    const uploadPath = Array.isArray(uploadResult) ? uploadResult[0] : uploadResult?.path;
    if (typeof uploadPath !== "string" || !uploadPath) throw new Error("Space не подтвердил загрузку исходного изображения.");

    const seed = Math.floor(Math.random() * 2147483647);
    const payload = {
      data: [
        { path: uploadPath, meta: { _type: "gradio.FileData" } },
        prompt,
        steps,
        "low quality, blurry, static image, text, watermark, deformed anatomy, flicker, duplicate limbs",
        duration, 1, 1, seed, true
      ]
    };
    const start = await fetch(HF_SPACE + "/gradio_api/call/generate_video", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(hfToken ? { Authorization: "Bearer " + hfToken } : {}) },
      body: JSON.stringify(payload),
    });
    if (!start.ok) throw new Error("Space отклонил запрос генерации (HTTP " + start.status + ").");
    const started = await start.json();
    const eventId = started?.event_id;
    if (!eventId) throw new Error("Space не выдал идентификатор задания.");

    const resultResponse = await fetch(HF_SPACE + "/gradio_api/call/generate_video/" + encodeURIComponent(eventId), {
      headers: hfToken ? { Authorization: "Bearer " + hfToken } : {},
      signal: AbortSignal.timeout(140_000),
    });
    if (!resultResponse.ok) throw new Error("Не удалось получить результат генерации (HTTP " + resultResponse.status + ").");
    const data = await readSSE(resultResponse);
    const remoteUrl = outputUrl(data[0]);
    if (!remoteUrl) throw new Error("Генерация завершилась, но Space не вернул распознаваемую ссылку на видео.");

    const videoResponse = await fetch(remoteUrl, { signal: AbortSignal.timeout(45_000) });
    if (!videoResponse.ok) throw new Error("Не удалось скачать результат из Space (HTTP " + videoResponse.status + ").");
    const contentType = videoResponse.headers.get("content-type") || "video/mp4";
    if (!contentType.startsWith("video/") && !contentType.includes("octet-stream")) throw new Error("Space вернул файл неожиданного типа: " + contentType);
    const videoBytes = new Uint8Array(await videoResponse.arrayBuffer());
    if (!videoBytes.length || videoBytes.length > 100 * 1024 * 1024) throw new Error("Размер видео пустой или превышает лимит QUN Storage (100 МБ).");
    const ext = contentType.includes("webm") ? "webm" : contentType.includes("quicktime") ? "mov" : "mp4";
    const hash = await sha256(videoBytes);
    const objectPath = auth.user.id + "/" + crypto.randomUUID() + "." + ext;
    const { error: storageError } = await db.storage.from(BUCKET).upload(objectPath, videoBytes, {
      contentType: contentType.startsWith("video/") ? contentType : "video/mp4", upsert: false,
    });
    if (storageError) throw new Error("Видео создано, но сохранить в QUN Storage не удалось: " + storageError.message);
    const title = "QUN Wan 2.2 — " + prompt.slice(0, 80);
    const { data: asset, error: assetError } = await db.from("qun_studio_assets").insert({
      project_id: projectId || null,
      title, asset_type: "video", provider: "huggingface-wan2.2", asset_url: null, preview_url: null,
      prompt, status: "ready", tags: ["QUN", "Wan 2.2", "AI video", "ZeroGPU"], created_by: auth.user.id,
      metadata: {
        storage_bucket: BUCKET, storage_path: objectPath, sha256: hash,
        size_bytes: videoBytes.length, content_type: contentType, duration, steps, seed,
        source: "Hugging Face ZeroGPU",
        zero_gpu_auth_mode: publicZeroGpu ? "anonymous" : "authenticated",
        project_id: projectId || null
      },
    }).select("id,title,created_at,metadata").single();
    if (assetError) {
      await db.storage.from(BUCKET).remove([objectPath]);
      throw new Error("Файл загружен, но запись в библиотеке не создана: " + assetError.message);
    }
    const { data: signed, error: signError } = await db.storage.from(BUCKET).createSignedUrl(objectPath, 60 * 60 * 24 * 7);
    if (signError || !signed?.signedUrl) return json({ ok: true, asset, storagePath: objectPath, warning: "Видео сохранено, но временную ссылку не удалось создать." });
    return json({ ok: true, asset, storagePath: objectPath, videoUrl: signed.signedUrl, sha256: hash, sizeBytes: videoBytes.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка генерации.";
    return json({ error: message }, 502);
  }
});