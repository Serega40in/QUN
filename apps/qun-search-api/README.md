# QUN Search API

Cloudflare Worker endpoint for the first real web-search MVP.

## Current status
- `GET /health` reports service health and whether a provider key is configured.
- `GET /api/search?q=...` validates a query and returns normalized real results from Tavily.
- Query limits, timeout, safe URL validation, normalized errors, and optional origin allow-list are implemented.
- This is an API scaffold committed to GitHub; it is **not deployed yet** and does not create an independent QUN web index.

## Configure and deploy
1. Install Node.js and Wrangler, then authenticate to the Cloudflare account.
2. From this directory, initialize/configure Wrangler for a Worker named `qun-search-api` (for example, add a `wrangler.toml` with `name = "qun-search-api"`, `main = "src/index.js"`, and a current compatibility date).
3. Create a Tavily API key in the provider dashboard. Check the current plan, quota, and terms before enabling public traffic.
4. Add the key as a Worker secret; never commit it:
   ```sh
   npx wrangler secret put TAVILY_API_KEY
   ```
5. Optionally set `ALLOWED_ORIGINS` as a Worker variable to a comma-separated list of exact trusted origins, including the QUN GitHub Pages origin. If omitted, browser cross-origin requests are not allowed by this code.
6. Deploy:
   ```sh
   npx wrangler deploy
   ```
7. Test `/health` and `/api/search?q=QUN` on the deployed Worker.

## Response format
Successful requests return `ok`, `query`, `provider`, `mode`, `results[]`, `result_count`, and a notice identifying the external provider. Each result contains `rank`, `title`, `url`, `snippet`, `score`, `source`, and optional `published_at`.

## Before public launch
- Add rate limiting and abuse monitoring at Cloudflare.
- Add request-level quotas and a clear user-facing privacy notice.
- Connect `search/index.html` to the deployed API only after endpoint deployment and smoke tests.
- Keep internal QUN catalogue search as a separate tab/mode.
- Do not describe this provider-backed version as a fully independent search engine.
- Build QUN's own crawler, index, and ranking as a separate subsequent milestone.
