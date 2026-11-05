/**
 * QUN Telegram Control — MVP Worker
 *
 * Required Worker secrets:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_WEBHOOK_SECRET
 *   QUN_API_KEY
 * Required vars:
 *   ADMIN_IDS        comma-separated Telegram user IDs
 *   CHANNEL_ID       target channel, e.g. @qunnews
 * Optional KV binding:
 *   QUN_TELEGRAM_KV
 *
 * Deploy first, then set Telegram webhook with the webhook secret.
 */
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function isAdmin(update, env) {
  const id = update?.message?.from?.id ?? update?.callback_query?.from?.id;
  const allowed = (env.ADMIN_IDS || "").split(",").map((v) => v.trim()).filter(Boolean);
  return id != null && allowed.includes(String(id));
}

async function telegram(env, method, payload) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Telegram bot token is not configured");
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram API error: ${response.status}`);
  return result.result;
}

async function bump(env, key) {
  if (!env.QUN_TELEGRAM_KV) return;
  const current = Number((await env.QUN_TELEGRAM_KV.get(key)) || "0");
  await env.QUN_TELEGRAM_KV.put(key, String(current + 1));
}

async function reply(env, chatId, text) {
  return telegram(env, "sendMessage", {
    chat_id: chatId,
    text,
    link_preview_options: { is_disabled: true },
  });
}

async function handleUpdate(update, env) {
  const message = update?.message;
  if (!message) return;
  await bump(env, "updates:total");
  if (message.from?.id) await bump(env, `users:${message.from.id}:updates`);

  const text = (message.text || message.caption || "").trim();
  const chatId = message.chat?.id;
  if (!chatId) return;

  if (text.startsWith("/start")) {
    await reply(env, chatId,
      "Привет! Это QUN Control. Здесь будем рассказывать о платформе QUN, блокчейне и разработке.\n\nКоманды: /help — помощь, /status — статус, /contact — связь с командой.");
    return;
  }
  if (text.startsWith("/help")) {
    await reply(env, chatId,
      "QUN Control — бот проекта QUN. Сейчас доступны базовые команды. Публикации в канал выполняются только через защищённый API и авторизованного администратора.\n\n/help — помощь\n/status — статус\n/contact — связь с командой");
    return;
  }
  if (text.startsWith("/status")) {
    await reply(env, chatId, "QUN Telegram Control: бот получил сообщение. Полная интеграция с QUN API и ИИ-ответами подключается отдельным этапом.");
    return;
  }
  if (text.startsWith("/contact")) {
    await reply(env, chatId, "Напишите, пожалуйста, кратко, по какому вопросу QUN хотите связаться с командой. Пока это сообщение не передаётся автоматически в ChatGPT.");
    return;
  }

  // Do not echo private user content into logs or other chats.
  if (message.chat.type === "private" && !text.startsWith("/")) {
    await reply(env, chatId, "Спасибо за сообщение! Приём работает. Подключение ответов ИИ и панели обработки обращений — следующий этап.");
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "qun-telegram-control", version: "0.1.0" });
    }

    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (!env.TELEGRAM_WEBHOOK_SECRET || provided !== env.TELEGRAM_WEBHOOK_SECRET) {
        return json({ ok: false, error: "unauthorized" }, 401);
      }
      let update;
      try { update = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
      try {
        await handleUpdate(update, env);
        return json({ ok: true });
      } catch (error) {
        return json({ ok: false, error: "update_failed" }, 500);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/publish") {
      const auth = request.headers.get("Authorization") || "";
      if (!env.QUN_API_KEY || auth !== `Bearer ${env.QUN_API_KEY}`) {
        return json({ ok: false, error: "unauthorized" }, 401);
      }
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
      const chatId = body.channel_id || env.CHANNEL_ID;
      if (!chatId) return json({ ok: false, error: "CHANNEL_ID_not_configured" }, 400);
      if (typeof body.text !== "string" || !body.text.trim()) {
        return json({ ok: false, error: "text_required" }, 400);
      }
      try {
        let result;
        if (body.photo_url) {
          result = await telegram(env, "sendPhoto", {
            chat_id: chatId,
            photo: body.photo_url,
            caption: body.text.slice(0, 1024),
            parse_mode: body.parse_mode || "HTML",
          });
        } else {
          result = await telegram(env, "sendMessage", {
            chat_id: chatId,
            text: body.text.slice(0, 4096),
            parse_mode: body.parse_mode || "HTML",
            link_preview_options: { is_disabled: false },
          });
        }
        await bump(env, "posts:total");
        return json({ ok: true, message_id: result.message_id, chat_id: result.chat.id });
      } catch (error) {
        return json({ ok: false, error: "telegram_publish_failed" }, 502);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/stats") {
      const auth = request.headers.get("Authorization") || "";
      if (!env.QUN_API_KEY || auth !== `Bearer ${env.QUN_API_KEY}`) {
        return json({ ok: false, error: "unauthorized" }, 401);
      }
      const read = async (key) => Number((await env.QUN_TELEGRAM_KV?.get(key)) || "0");
      return json({
        ok: true,
        updates_total: await read("updates:total"),
        posts_total: await read("posts:total"),
      });
    }

    return json({ ok: false, error: "not_found" }, 404);
  },
};
