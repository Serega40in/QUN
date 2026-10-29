import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
const cors = {
  "Access-Control-Allow-Origin": "https://serega40in.github.io",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, authorization, x-client-info",
  "Vary": "Origin",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  try {
    const origin = req.headers.get("Origin");
    if (origin && origin !== "https://serega40in.github.io") return json({ error: "Origin not allowed" }, 403);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Войди в QUN, чтобы использовать творческого помощника." }, 401);
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "Сессия QUN недействительна. Войди снова." }, 401);

    const body = await req.json().catch(() => ({}));
    const idea = String(body.idea || "").trim().slice(0, 2500);
    if (idea.length < 4) return json({ error: "Опиши идею минимум четырьмя символами." }, 400);
    if (body.task && body.task !== "creative_brief") return json({ error: "Неизвестный тип задачи." }, 400);

    const credentials = Deno.env.get("GIGACHAT_CREDENTIALS");
    if (!credentials) return json({
      error: "Серверный ключ ГигаЧата ещё не настроен. Добавь GIGACHAT_CREDENTIALS в Secrets функции Supabase."
    }, 503);

    const scope = Deno.env.get("GIGACHAT_SCOPE") || "GIGACHAT_API_PERS";
    const tokenResponse = await fetch("https://ngw.devices.sberbank.ru:9443/api/v2/oauth", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "RqUID": crypto.randomUUID(),
        "Authorization": "Basic " + credentials,
      },
      body: new URLSearchParams({ scope }),
    });
    if (!tokenResponse.ok) {
      const detail = (await tokenResponse.text()).slice(0, 300);
      return json({ error: "GigaChat OAuth вернул HTTP " + tokenResponse.status + ": " + detail }, 502);
    }
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) return json({ error: "GigaChat не вернул access token." }, 502);

    const prompt = [
      "Ты — творческий редактор QUN Masterpiece. Отвечай на русском языке.",
      "Развивай замысел пользователя бережно, не стирай его авторский замысел.",
      "Верни краткий, пригодный для работы творческий бриф со следующими разделами: Суть идеи; Визуальный образ; Атмосфера и палитра; Готовый промпт; Возможное развитие в серию или клип.",
      "Не утверждай, что медиа уже сгенерировано. Не обещай коммерческий успех. Максимум 900 слов."
    ].join("\n");
    const chatResponse = await fetch("https://api.giga.chat/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + tokenData.access_token,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("GIGACHAT_MODEL") || "GigaChat-2",
        temperature: 0.7,
        max_tokens: 1200,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: idea },
        ],
      }),
    });
    if (!chatResponse.ok) {
      const detail = (await chatResponse.text()).slice(0, 300);
      return json({ error: "GigaChat вернул HTTP " + chatResponse.status + ": " + detail }, 502);
    }
    const chat = await chatResponse.json();
    const result = chat?.choices?.[0]?.message?.content;
    if (typeof result !== "string" || !result.trim()) return json({ error: "GigaChat вернул пустой ответ." }, 502);
    return json({ result: result.trim(), model: chat.model || Deno.env.get("GIGACHAT_MODEL") || "GigaChat-2" });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Внутренняя ошибка творческого помощника." }, 500);
  }
});
