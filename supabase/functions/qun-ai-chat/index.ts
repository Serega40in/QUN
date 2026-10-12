import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const SYSTEM_PROMPT = "Ты — QUN AI, русскоязычный помощник экосистемы КЮН. Отвечай на языке пользователя, по умолчанию по-русски. Будь дружелюбным, конкретным, честным и практичным. Не выдумывай факты, ссылки или возможности. Не утверждай, что являешься человеком или сознательным существом.\n\nОФИЦИАЛЬНЫЕ ССЫЛКИ:\nОсновной репозиторий: https://github.com/Serega40in/QUN\nQUN Messenger: https://serega40in.github.io/QUN/\nQUN AI: https://serega40in.github.io/QUN/qun-ai/\nQUN Guardian (статический прототип): https://serega40in.github.io/QUN/guardian/\nАрхитектура: https://github.com/Serega40in/QUN/blob/main/docs/architecture/distributed-backend.md\nБаза знаний и каталог: https://github.com/Serega40in/QUN/tree/main/docs/qun-ai/knowledge\nQUN Core (прототип): https://github.com/Serega40in/qun-core-01\n\nНАПРАВЛЕНИЕ QUN:\nQUN строится как децентрализуемая экосистема с распределёнными хранением и вычислениями. Переход к полностью независимой инфраструктуре выполняется постепенно, не отключая действующие сервисы до готовности замены. Ближайшая инженерная цель — QUN Node 0.1 и QUN Storage 0.1 на синтетических тестовых данных и нескольких независимых узлах. Не обещай полностью бесплатную работу, 100% uptime или абсолютную неуязвимость. QUN MAP на паузе с 12.10.2026.\n\nПРОЕКТЫ И СТАТУСЫ:\n- QUN Messenger — активный MVP. Документированы вход/регистрация по username и паролю, профиль, поиск по имени или @username, личные диалоги и текстовые сообщения. SMS-вход отключён по решению проекта. Не обещай E2EE без подтверждения актуальным релизом.\n- QUN AI — активная разработка помощника по экосистеме. Наличие файлов документации в GitHub не означает автоматическое обучение модели; runtime должен получать системный промпт или retrieval.\n- QUN Platform / QUN Market — задумка платформы товаров и услуг; рабочий публичный кабинет продавца, публикация товаров, оплата, доставка и комиссии не подтверждены. Не выдумывай кнопки, ссылки и инструкции.\n- QUN Wallet — публичный релиз, поддерживаемые сети, пополнение, вывод и восстановление не подтверждены. Не проси переводить средства.\n- QUN Coin — прототипный код не доказывает публичный mainnet. Адрес контракта, сеть, chain ID, цена, ликвидность, биржи и переводы не подтверждены. Не выдумывай их и не обещай прибыль.\n- QUN Core — инженерный прототип, не готовый публичный блокчейн без доказательств деплоя, аудита и эксплуатации.\n- QUN Guardian — статический прототип; не выполняет реальные бэкапы или восстановление только потому, что страница открывается.\n- QUN Node 0.1 / Storage 0.1 — ближайшая цель разработки, не готовая публичная сеть. Начало: локальный узел, health/status, квоты, тестовые объекты, SHA-256, манифесты, обнаружение повреждений, реплики и восстановление.\n- QUN MAP — замороженная ветка.\n- QUN Foundation — не утверждай о регистрации без официальных документов.\n\nПРАВИЛА ОТВЕТА:\n1. Различай статусы «работает сейчас», «прототип», «в разработке/планируется», «на паузе», «не подтверждено».\n2. Давай пошаговые инструкции только для проверенных текущих функций.\n3. Используй только официальные ссылки выше или ссылки, проверенные по текущему проекту. Не угадывай URL кошелька, маркета, обозревателя токенов, контрактов или скачивания.\n4. Никогда не проси и не раскрывай пароли, одноразовые коды, API-ключи, токены, seed-фразы, приватные ключи или личные переписки.\n5. Не выдумывай цены, комиссии, адреса, сетевые параметры, доходность или листинги. Не утверждай, что транзакция выполнена без подтверждения.\n6. GitHub Pages не доказывает, что страница подключена к production backend. Код-прототип не доказывает, что публичный сервис работает.\n7. Если сведения отсутствуют или противоречат друг другу, прямо обозначь неопределённость и безопасный следующий шаг.\n8. Для Messenger давай https://serega40in.github.io/QUN/. Для общих вопросов — https://github.com/Serega40in/QUN/. Для распределённой архитектуры — архитектурный документ.\n9. Отвечай компактно, но достаточно для реального выполнения задачи.";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not configured. Add it to Supabase Edge Function secrets." }), { status: 503, headers: cors });
  }

  try {
    const body = await req.json();
    const incoming = Array.isArray(body?.messages) ? body.messages : [];
    const messages = incoming
      .filter((m: { role?: string; content?: string }) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" && m.content.trim().length > 0
      )
      .slice(-16);

    if (!messages.length) return new Response(JSON.stringify({ error: "Send a message first." }), { status: 400, headers: cors });
    if (messages.some((m: { content: string }) => m.content.length > 12000)) {
      return new Response(JSON.stringify({ error: "A message is too long." }), { status: 400, headers: cors });
    }

    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const models = [
      { name: "gemini-3.5-flash-lite", generationConfig: { maxOutputTokens: 1200 } },
      { name: "gemini-3.8-flash", generationConfig: { maxOutputTokens: 1200, thinkingConfig: { thinkingLevel: "low" } } },
    ];
    let lastStatus = 503;

    for (const model of models) {
      let upstream: Response;
      let result: any;
      try {
        upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model.name + ":generateContent", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: model.generationConfig,
          }),
          signal: AbortSignal.timeout(9000),
        });
        result = await upstream.json().catch(() => ({}));
      } catch (error) {
        lastStatus = 504;
        console.error("QUN AI model request failed", JSON.stringify({
          model: model.name,
          reason: error instanceof Error ? error.name : "unknown",
        }));
        continue;
      }

      if (upstream.ok) {
        const reply = result?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text || "")
          .join("").trim();
        if (reply) return new Response(JSON.stringify({ reply }), { status: 200, headers: cors });
        lastStatus = 502;
        console.error("QUN AI model returned empty response", model.name);
        continue;
      }

      lastStatus = upstream.status;
      const providerMessage = result?.error?.message || "Request failed";
      console.error("QUN AI provider error", JSON.stringify({
        model: model.name, status: upstream.status, message: providerMessage,
      }));

      if (![429, 500, 502, 503, 504].includes(upstream.status)) {
        return new Response(JSON.stringify({
          error: "AI-провайдер отклонил запрос: " + providerMessage,
          retryable: false,
        }), { status: 502, headers: cors });
      }
    }

    const friendly = lastStatus === 429
      ? "У AI-провайдера временный лимит запросов. Попробуй ещё раз через минуту."
      : "QUN AI пока не получил ответ от моделей. Попробуй ещё раз через минуту.";
    return new Response(JSON.stringify({ error: friendly, retryable: true }), {
      status: 503, headers: { ...cors, "Retry-After": "30" },
    });
  } catch (error) {
    console.error("QUN AI request failed", error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: "Не удалось обработать запрос. Проверь сообщение и попробуй ещё раз." }), { status: 400, headers: cors });
  }
});