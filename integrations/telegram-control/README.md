# QUN Telegram Control MVP

This is the first implementation slice for the QUN Telegram bot bridge. It is intentionally not deployed and does not contain credentials.

## Scope of this phase
- Telegram webhook with secret-token verification.
- Basic /start, /help, /status, /contact commands.
- Protected publishing endpoint for text and image-by-URL posts.
- Protected aggregate counters for received updates and published posts.
- No Gmail sending, no outreach, no mass mailing, and no automatic public announcements.
- No claim that messages are already connected to ChatGPT. An authenticated ChatGPT/plugin bridge is a separate integration step.

## Deploy to Cloudflare Workers (free tier where available)
1. Create a Worker in the existing Cloudflare account.
2. Add Worker secrets:
   - `TELEGRAM_BOT_TOKEN`: token from BotFather. Never commit it.
   - `TELEGRAM_WEBHOOK_SECRET`: random secret string (Telegram accepts 1–256 characters from its documented allowed set).
   - `QUN_API_KEY`: a separate long random key for the publishing API.
3. Add Worker variables:
   - `ADMIN_IDS`: your numeric Telegram user ID(s), comma-separated.
   - `CHANNEL_ID`: channel username such as `@qunnews` (or numeric chat ID).
4. Create a KV namespace and bind it as `QUN_TELEGRAM_KV` for aggregate stats. The worker will still function without KV, but counters will remain zero.
5. Deploy `worker.js`.
6. Add the bot to the target Telegram channel as an administrator with permission to post.
7. Set webhook, replacing placeholders locally and never sharing the bot token in chat:
```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://YOUR-WORKER.workers.dev/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
``
8. Verify with `getWebhookInfo` and test /start in a private chat.

## API examples
Publish text:
```bash
curl -X POST "https://YOUR-WORKER.workers.dev/api/publish" \
  -H "Authorization: Bearer $QUN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"<b>QUN update</b>\nWe are building our platform and blockchain."}'
``

Publish an image from an accessible HTTPS URL:
```bash
curl -X POST "https://YOUR-WORKER.workers.dev/api/publish" \
  -H "Authorization: Bearer $QUN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"QUN development update","photo_url":"https://example.com/announcement.jpg"}'
``

Stats:
```bash
curl -H "Authorization: Bearer $QUN_API_KEY" \
  "https://YOUR-WORKER.workers.dev/api/stats"
``

## Important limitations
- This phase receives Telegram updates and responds with fixed messages; it does not yet invoke an LLM or forward full conversations to ChatGPT.
- The stats endpoint only provides aggregate update/post counters, not Telegram channel reach or views. Those metrics are not generally available through the Bot API.
- The current photo endpoint accepts a public HTTPS image URL. Uploading a binary image and media groups can be added next.
- Add rate limits, stronger abuse controls, request idempotency, and tests before production use.
