# QUN Telegram Control MVP

This is the first implementation slice for the QUN Telegram bot bridge. Source code is committed to the feature branch; deployment and live Telegram integration are not yet verified. No credentials are stored in this repository.

## Scope
- Telegram webhook with secret-token verification.
- Basic `/start`, `/help`, `/status`, and `/contact` commands.
- Native Telegram HTML widgets: `/pulse`, `/intention`, and `/roadmap`.
- `widget_query` handling for Pulse and roadmap votes, with optional Cloudflare KV vote storage.
- Protected API for publishing text and an image from a public HTTPS URL.
- Protected aggregate counters for received updates and published posts.
- OpenAPI contract for the future QUN Control ChatGPT plugin.
- Manual GitHub Actions deployment path; no Codex required.
- No Gmail sending, outreach, mass mailing, or automatic public announcements.

## Deploy without Codex

The workflow `.github/workflows/deploy-qun-telegram-control.yml` deploys the Worker from this repository using GitHub Actions.

1. In Cloudflare, create an API token with permission to edit Workers for the relevant account. Keep the token private.
2. In GitHub, open **Settings → Secrets and variables → Actions** for this repository and add:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. Ensure the workflow and this directory are on the branch you intend to deploy. Open **Actions → Deploy QUN Telegram Control → Run workflow** and select that branch.
4. After the first deployment, find the deployed `workers.dev` URL in the workflow output or Cloudflare dashboard.
5. In the Worker settings in Cloudflare, add these **secrets** (never commit them):
   - `TELEGRAM_BOT_TOKEN`: token from BotFather.
   - `TELEGRAM_WEBHOOK_SECRET`: random secret string.
   - `QUN_API_KEY`: a separate long random key for the QUN API.
6. Configure Worker variables:
   - `CHANNEL_ID`: target channel, e.g. `@qunnews`.
   - `ADMIN_IDS`: numeric Telegram user IDs, comma-separated.
7. Add the bot to the target channel as an administrator with permission to post.
8. Set the webhook using the actual Worker URL. Run this from a local terminal or another trusted environment; do not paste the bot token into ChatGPT:
```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://YOUR-WORKER.workers.dev/telegram/webhook" \
  --data-urlencode "secret_token=$TELEGRAM_WEBHOOK_SECRET" \\
  --data-urlencode 'allowed_updates=["message","widget_query"]'
```
9. Verify `getWebhookInfo` and send `/start` to the bot in a private chat.

The GitHub Actions deployment requires you to add the two Cloudflare GitHub secrets. The Worker will not be deployed until you trigger the workflow. Cloudflare API access is not available directly from this ChatGPT session.

## Widgets

After deploying this branch and setting the webhook, open the bot's private chat and try:
- `/pulse` — vote for calm, clarity, or kindness.
- `/intention` — a local-only daily intention picker.
- `/roadmap` — vote for QUN Messenger, QUN AI Studio, or QUN Market.

The Worker handles `widget_query` and answers each request. Create a Cloudflare KV namespace and bind it as `QUN_TELEGRAM_KV` to persist vote counts and aggregate counters. Without KV, widgets still open and respond, but votes are acknowledged without persistent counting. The poll prototypes are initial versions; the bot backend must be deployed before they work in Telegram. Telegram currently supports production widgets only in private chats with the bot; they cannot be posted directly to channels.

## Optional aggregate statistics

Create a Cloudflare KV namespace and bind it to the Worker as `QUN_TELEGRAM_KV`. Without this binding, the Worker runs but aggregate counters remain zero. Current counters are total updates and successful posts; they are not channel reach or view analytics.

## API endpoints

- `GET /health` — public service health check.
- `GET /api/stats` — aggregate counters, requires `Authorization: Bearer <QUN_API_KEY>`.
- `POST /api/publish` — publishes text or a public HTTPS image URL, requires the same bearer key.

The API contract is in `openapi.yaml`. After deployment, replace its placeholder server URL with the actual Worker URL before creating the private ChatGPT plugin. The ChatGPT plugin must not be considered connected until its tools appear and a real health-check call succeeds.

Example publish request:
```bash
curl -X POST "https://YOUR-WORKER.workers.dev/api/publish" \
  -H "Authorization: Bearer $QUN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"<b>QUN development update</b>","photo_url":"https://example.com/announcement.jpg"}'
```

## Current limitations and next work
- Telegram messages receive fixed replies; no LLM is connected yet.
- `ADMIN_IDS` is configured but is not currently used to authorize individual Telegram commands.
- Photo publishing currently accepts a public HTTPS URL, not binary uploads or media groups.
- Add rate limiting, request idempotency, tests, and safer HTML handling before production.
- Telegram channel views/reach are not supplied by these aggregate Bot API counters.
- No post should be sent until the exact text and destination have been explicitly approved.
