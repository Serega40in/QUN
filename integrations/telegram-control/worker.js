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
const WIDGET_PULSE = "<div class=\"wrap\">\n  <div class=\"brand\">QUN PULSE · 01</div>\n  <h3>Чего миру сейчас нужно больше?</h3>\n  <p class=\"sub\">Выбери один ответ. Твой голос можно обработать через QUN-бота.</p>\n  <div class=\"choices\">\n    <button onclick=\"vote('pulse:calm')\">☁️ Спокойствия</button>\n    <button onclick=\"vote('pulse:clarity')\">💎 Ясности</button>\n    <button onclick=\"vote('pulse:kindness')\">🌿 Доброты</button>\n  </div>\n  <p id=\"status\" class=\"hint\">Один выбор — маленький вклад в общее направление.</p>\n</div>\n<style>\n.wrap{font-family:system-ui,sans-serif;color:var(--tg-theme-text-color);padding:4px}\n.brand{font-size:11px;font-weight:800;letter-spacing:1.5px;color:var(--tg-theme-accent-text-color);margin-bottom:8px}\nh3{font-size:18px;line-height:1.25;margin:0 0 8px}\n.sub,.hint{font-size:13px;color:var(--tg-theme-hint-color);line-height:1.4}\n.choices{display:grid;gap:7px;margin-top:12px}\nbutton{width:100%;text-align:left;border:1px solid var(--tg-theme-section-separator-color);border-radius:10px;padding:11px;background:var(--tg-theme-secondary-bg-color);color:var(--tg-theme-text-color);font-size:14px}\n</style>\n<script>\nfunction vote(data){\n const s=document.getElementById('status');\n if(!window.TelegramWidget){s.textContent='Демо: голос «'+data.split(':')[1]+'» выбран.';return}\n s.textContent='Передаём голос…';\n TelegramWidget.request(data).then(a=>{s.textContent=a.result||'Спасибо! Голос принят.'},e=>{s.textContent='Пока не удалось отправить: '+e.code});\n}\nif(window.TelegramWidget)TelegramWidget.ready();\n</script>\n";
const WIDGET_INTENTION = "<div class=\"wrap\">\n  <div class=\"brand\">QUN <span>· маленький шаг к ясности</span></div>\n  <h3>Какое качество ты выбираешь сегодня?</h3>\n  <div class=\"choices\">\n    <button onclick=\"choose('Спокойствие')\">☁️ Спокойствие</button>\n    <button onclick=\"choose('Ясность')\">💎 Ясность</button>\n    <button onclick=\"choose('Доброта')\">🌿 Доброта</button>\n    <button onclick=\"choose('Смелость')\">☀️ Смелость</button>\n  </div>\n  <p id=\"result\" class=\"hint\">Выбери намерение — без спешки и давления.</p>\n</div>\n<style>\n.wrap{font-family:system-ui,sans-serif;color:var(--tg-theme-text-color);padding:4px}\n.brand{font-size:12px;font-weight:700;color:var(--tg-theme-accent-text-color);margin-bottom:8px}\n.brand span{font-weight:400;color:var(--tg-theme-hint-color)}\nh3{font-size:18px;line-height:1.25;margin:0 0 12px}\n.choices{display:grid;grid-template-columns:1fr 1fr;gap:8px}\nbutton{border:1px solid var(--tg-theme-section-separator-color);border-radius:12px;padding:12px 6px;background:var(--tg-theme-secondary-bg-color);color:var(--tg-theme-text-color);font-size:14px}\nbutton:active{opacity:.75}\n.hint{font-size:13px;color:var(--tg-theme-hint-color);margin:12px 0 2px}\n</style>\n<script>\nfunction choose(value){\n  document.getElementById('result').textContent='Твоё намерение на сегодня: '+value+'. Пусть оно проявится в одном простом действии.';\n  if(window.TelegramWidget&&TelegramWidget.HapticFeedback)TelegramWidget.HapticFeedback.selectionChanged();\n}\nif(window.TelegramWidget)TelegramWidget.ready();\n</script>\n";
const WIDGET_ROADMAP = "<div class=\"wrap\">\n  <div class=\"top\"><span class=\"gem\">◆</span> QUN BUILD TOGETHER</div>\n  <h3>Что развиваем следующим?</h3>\n  <p class=\"sub\">Помоги выбрать направление сообщества.</p>\n  <button onclick=\"vote('roadmap:messenger')\"><b>01</b><span><strong>QUN Messenger</strong><small>Общение и звонки</small></span><i>↗</i></button>\n  <button onclick=\"vote('roadmap:ai')\"><b>02</b><span><strong>QUN AI Studio</strong><small>Творчество и инструменты ИИ</small></span><i>↗</i></button>\n  <button onclick=\"vote('roadmap:market')\"><b>03</b><span><strong>QUN Market</strong><small>Сервисы и полезные продукты</small></span><i>↗</i></button>\n  <p id=\"status\" class=\"hint\">Твой выбор поможет расставить приоритеты.</p>\n</div>\n<style>\n.wrap{font-family:system-ui,sans-serif;color:var(--tg-theme-text-color);padding:4px}\n.top{font-size:11px;letter-spacing:1.2px;font-weight:800;color:var(--tg-theme-accent-text-color);margin-bottom:8px}\n.gem{font-size:16px;margin-right:5px}\nh3{font-size:19px;margin:0 0 5px;line-height:1.25}\n.sub,.hint{font-size:13px;color:var(--tg-theme-hint-color);line-height:1.4}\nbutton{display:flex;align-items:center;gap:10px;width:100%;margin:8px 0;padding:10px;border:1px solid var(--tg-theme-section-separator-color);border-radius:12px;background:var(--tg-theme-secondary-bg-color);color:var(--tg-theme-text-color);text-align:left}\nbutton b{font-size:11px;color:var(--tg-theme-accent-text-color)}\nbutton span{display:flex;flex:1;flex-direction:column;gap:3px}\nbutton strong{font-size:14px}\nbutton small{font-size:12px;color:var(--tg-theme-hint-color)}\nbutton i{font-style:normal}\n</style>\n<script>\nfunction vote(data){\n const s=document.getElementById('status');\n if(!window.TelegramWidget){s.textContent='Демо: выбран '+data.split(':')[1]+'.';return}\n s.textContent='Отправляем выбор…';\n TelegramWidget.request(data).then(a=>{s.textContent=a.result||'Спасибо! Выбор принят.'},e=>{s.textContent='Ошибка отправки: '+e.code});\n}\nif(window.TelegramWidget)TelegramWidget.ready();\n</script>\n";

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


async function handleWidgetQuery(update, env) {
  const q = update?.widget_query;
  if (!q?.id || !q?.from?.id) return;
  const data = String(q.data || "");
  const choices = {
    "pulse:calm": ["pulse", "calm", "спокойствие"],
    "pulse:clarity": ["pulse", "clarity", "ясность"],
    "pulse:kindness": ["pulse", "kindness", "доброту"],
    "roadmap:messenger": ["roadmap", "messenger", "QUN Messenger"],
    "roadmap:ai": ["roadmap", "ai", "QUN AI Studio"],
    "roadmap:market": ["roadmap", "market", "QUN Market"],
  };
  const choice = choices[data];
  let answer = "Не удалось распознать выбор. Попробуй ещё раз.";
  if (choice) {
    const [poll, option, label] = choice;
    if (!env.QUN_TELEGRAM_KV) {
      answer = "Спасибо за выбор: " + label + "! Для подсчёта голосов ещё нужно подключить KV в Cloudflare.";
    } else {
      const userKey = `vote:${poll}:user:${q.from.id}`;
      const old = await env.QUN_TELEGRAM_KV.get(userKey);
      if (old === option) {
        answer = "Твой выбор «" + label + "» уже учтён. Спасибо!";
      } else {
        if (old) {
          const oldCountKey = `vote:${poll}:count:${old}`;
          const oldCount = Math.max(0, Number((await env.QUN_TELEGRAM_KV.get(oldCountKey)) || "0") - 1);
          await env.QUN_TELEGRAM_KV.put(oldCountKey, String(oldCount));
        }
        const countKey = `vote:${poll}:count:${option}`;
        const count = Number((await env.QUN_TELEGRAM_KV.get(countKey)) || "0") + 1;
        await env.QUN_TELEGRAM_KV.put(countKey, String(count));
        await env.QUN_TELEGRAM_KV.put(userKey, option);
        answer = "Готово! Твой выбор — «" + label + "». Сейчас за это направление " + count + (count === 1 ? " голос" : count < 5 ? " голоса" : " голосов") + ".";
      }
    }
  }
  await telegram(env, "answerWidgetQuery", { widget_query_id: q.id, data: answer });
}

async function handleUpdate(update, env) {
  if (update?.widget_query) {
    await handleWidgetQuery(update, env);
    return;
  }
  const message = update?.message;
  if (!message) return;
  await bump(env, "updates:total");
  if (message.from?.id) await bump(env, `users:${message.from.id}:updates`);

  const text = (message.text || message.caption || "").trim();
  const chatId = message.chat?.id;
  if (!chatId) return;

  if (text.startsWith("/start")) {
    await reply(env, chatId,
      "Привет! Это QUN Control. Здесь будем рассказывать о платформе QUN, блокчейне и разработке.\n\nКоманды: /help — помощь, /status — статус, /contact — связь с командой.\n\nВиджеты: /pulse — голос сообщества, /intention — намерение дня, /roadmap — выбор следующего направления QUN.");
    return;
  }
  if (text.startsWith("/help")) {
    await reply(env, chatId,
      "QUN Control — бот проекта QUN. Сейчас доступны базовые команды. Публикации в канал выполняются только через защищённый API и авторизованного администратора.\n\n/help — помощь\n/status — статус\n/contact — связь с командой");
    return;
  }
  if (text.startsWith("/pulse")) {
    await telegram(env, "sendWidget", { chat_id: chatId, html: WIDGET_PULSE, caption: "QUN Pulse — чего миру сейчас нужно больше?", allow_queries: true });
    return;
  }
  if (text.startsWith("/intention")) {
    await telegram(env, "sendWidget", { chat_id: chatId, html: WIDGET_INTENTION, caption: "QUN — намерение на сегодня" });
    return;
  }
  if (text.startsWith("/roadmap")) {
    await telegram(env, "sendWidget", { chat_id: chatId, html: WIDGET_ROADMAP, caption: "QUN Build Together — выбираем приоритет", allow_queries: true });
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
