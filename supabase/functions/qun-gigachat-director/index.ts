import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// Russian Trusted Root CA for GigaChat TLS.
// SHA-256: D26D2D0231B7C39F92CC738512BA54103519E4405D68B5BD703E9788CA8ECF31
const RUSSIAN_TRUSTED_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIFwjCCA6qgAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwcDELMAkGA1UEBhMCUlUx
PzA9BgNVBAoMNlRoZSBNaW5pc3RyeSBvZiBEaWdpdGFsIERldmVsb3BtZW50IGFu
ZCBDb21tdW5pY2F0aW9uczEgMB4GA1UEAwwXUnVzc2lhbiBUcnVzdGVkIFJvb3Qg
Q0EwHhcNMjIwMzAxMjEwNDE1WhcNMzIwMjI3MjEwNDE1WjBwMQswCQYDVQQGEwJS
VTE/MD0GA1UECgw2VGhlIE1pbmlzdHJ5IG9mIERpZ2l0YWwgRGV2ZWxvcG1lbnQg
YW5kIENvbW11bmljYXRpb25zMSAwHgYDVQQDDBdSdXNzaWFuIFRydXN0ZWQgUm9v
dCBDQTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAMfFOZ8pUAL3+r2n
qqE0Zp52selXsKGFYoG0GM5bwz1bSFtCt+AZQMhkWQheI3poZAToYJu69pHLKS6Q
XBiwBC1cvzYmUYKMYZC7jE5YhEU2bSL0mX7NaMxMDmH2/NwuOVRj8OImVa5s1F4U
zn4Kv3PFlDBjjSjXKVY9kmjUBsXQrIHeaqmUIsPIlNWUnimXS0I0abExqkbdrXbX
YwCOXhOO2pDUx3ckmJlCMUGacUTnylyQW2VsJIyIGA8V0xzdaeUXg0VZ6ZmNUr5Y
Ber/EAOLPb8NYpsAhJe2mXjMB/J9HNsoFMBFJ0lLOT/+dQvjbdRZoOT8eqJpWnVD
U+QL/qEZnz57N88OWM3rabJkRNdU/Z7x5SFIM9FrqtN8xewsiBWBI0K6XFuOBOTD
4V08o4TzJ8+Ccq5XlCUW2L48pZNCYuBDfBh7FxkB7qDgGDiaftEkZZfApRg2E+M9
G8wkNKTPLDc4wH0FDTijhgxR3Y4PiS1HL2Zhw7bD3CbslmEGgfnnZojNkJtcLeBH
BLa52/dSwNU4WWLubaYSiAmA9IUMX1/RpfpxOxd4Ykmhz97oFbUaDJFipIggx5sX
ePAlkTdWnv+RWBxlJwMQ25oEHmRguNYf4Zr/Rxr9cS93Y+mdXIZaBEE0KS2iLRqa
OiWBki9IMQU4phqPOBAaG7A+eP8PAgMBAAGjZjBkMB0GA1UdDgQWBBTh0YHlzlpf
BKrS6badZrHF+qwshzAfBgNVHSMEGDAWgBTh0YHlzlpfBKrS6badZrHF+qwshzAS
BgNVHRMBAf8ECDAGAQH/AgEEMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsF
AAOCAgEAALIY1wkilt/urfEVM5vKzr6utOeDWCUczmWX/RX4ljpRdgF+5fAIS4vH
tmXkqpSCOVeWUrJV9QvZn6L227ZwuE15cWi8DCDal3Ue90WgAJJZMfTshN4OI8cq
W9E4EG9wglbEtMnObHlms8F3CHmrw3k6KmUkWGoa+/ENmcVl68u/cMRl1JbW2bM+
/3A+SAg2c6iPDlehczKx2oa95QW0SkPPWGuNA/CE8CpyANIhu9XFrj3RQ3EqeRcS
AQQod1RNuHpfETLU/A2gMmvn/w/sx7TB3W5BPs6rprOA37tutPq9u6FTZOcG1Oqj
C/B7yTqgI7rbyvox7DEXoX7rIiEqyNNUguTk/u3SZ4VXE2kmxdmSh3TQvybfbnXV
4JbCZVaqiZraqc7oZMnRoWrXRG3ztbnbes/9qhRGI7PqXqeKJBztxRTEVj8ONs1d
WN5szTwaPIvhkhO3CO5ErU2rVdUr89wKpNXbBODFKRtgxUT70YpmJ46VVaqdAhOZ
D9EUUn4YaeLaS8AjSF/h7UkjOibNc4qVDiPP+rkehFWM66PVnP1Msh93tc+taIfC
EYVMxjh8zNbFuoc7fzvvrFILLe7ifvEIUqSVIC/AzplM/Jxw7buXFeGP1qVCBEHq
391d/9RAfaZ12zkwFsl+IKwE/OZxW8AHa9i1p4GO0YSNuczzEm4=
-----END CERTIFICATE-----`;
const gigaChatHttpClient = Deno.createHttpClient({ caCerts: [RUSSIAN_TRUSTED_ROOT_CA] });
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
const ALLOWED_ORIGINS = new Set(["https://quniverse.ru", "https://serega40in.github.io"]);
function corsFor(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://quniverse.ru",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, apikey, authorization, x-client-info",
    "Vary": "Origin",
  };
}
const json = (data: unknown, status = 200, origin: string | null = null) => new Response(JSON.stringify(data), {
  status, headers: { ...corsFor(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsFor(req.headers.get("Origin")) });
  if (req.method !== "POST") return json({ error: "POST required" }, 405, req.headers.get("Origin"));
  const origin = req.headers.get("Origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Войди в QUN, чтобы использовать творческого помощника." }, 401, origin);
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "Сессия QUN недействительна. Войди снова." }, 401, origin);

    const body = await req.json().catch(() => ({}));
    const idea = String(body.idea || "").trim().slice(0, 2500);
    if (idea.length < 4) return json({ error: "Опиши идею минимум четырьмя символами." }, 400, origin);
    const task = body.task || "creative_brief";
    if (!["creative_brief", "film_plan"].includes(task)) return json({ error: "Неизвестный тип задачи." }, 400, origin);
    const sceneCount = Math.max(2, Math.min(12, Math.floor(Number(body.scene_count) || 6)));


    const credentials = Deno.env.get("GIGACHAT_CREDENTIALS");
    if (!credentials) return json({
      error: "Серверный ключ ГигаЧата ещё не настроен. Добавь GIGACHAT_CREDENTIALS в Secrets функции Supabase."
    }, 503, origin);

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
    }, { client: gigaChatHttpClient });
    if (!tokenResponse.ok) {
      const detail = (await tokenResponse.text()).slice(0, 300);
      return json({ error: "GigaChat OAuth вернул HTTP " + tokenResponse.status + ": " + detail }, 502, origin);
    }
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) return json({ error: "GigaChat не вернул access token." }, 502, origin);

    const systemPrompt = task === "film_plan" ? [
      "Ты — режиссёр-постановщик QUN Masterpiece. Верни ТОЛЬКО валидный JSON без Markdown и без пояснений.",
      "Все названия, синопсис, палитра, описания сцен и заметки — на русском языке. Только visual_prompt должен быть на английском.",
      "Строгая схема: {\"title\":string,\"logline\":string,\"visual_style\":string,\"scenes\":[{\"title\":string,\"visual_prompt\":string}],\"assembly_notes\":string}.",
      "Нужно ровно " + sceneCount + " последовательных сцен. Каждая сцена — самостоятельный видеоклип 3–5 секунд с конкретным видимым действием и движением камеры.",
      "Сохраняй визуальную непрерывность: одинаковые персонажи, одежда, цвета, окружение и направление движения между сценами. Указывай ключевые признаки персонажей в каждом промпте.",
      "Промпты ориентируй на ComfyUI video workflows. Не используй текст, субтитры, надписи или логотипы внутри кадра. Описывай конкретный кадр, движение и атмосферу.",
      "Сцены должны развивать песню/историю с началом, развитием, поворотом и завершением. Избегай повторяющихся общих планов. Не утверждай, что видео уже создано."
    ].join("\n") : [
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
        max_tokens: task === "film_plan" ? 3600 : 1200,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: idea },
        ],
      }),
    }, { client: gigaChatHttpClient });
    if (!chatResponse.ok) {
      const detail = (await chatResponse.text()).slice(0, 300);
      return json({ error: "GigaChat вернул HTTP " + chatResponse.status + ": " + detail }, 502, origin);
    }
    const chat = await chatResponse.json();
    const result = chat?.choices?.[0]?.message?.content;
    if (typeof result !== "string" || !result.trim()) return json({ error: "GigaChat вернул пустой ответ." }, 502, origin);
    return json({ result: result.trim(), model: chat.model || Deno.env.get("GIGACHAT_MODEL") || "GigaChat-2" }, 200, origin);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Внутренняя ошибка творческого помощника." }, 500, origin);
  }
});