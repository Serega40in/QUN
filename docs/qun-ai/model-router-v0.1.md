# QUN Model Router 0.1 — design and rollout

Status: design proposal / implementation plan. This document does not claim that a provider catalogue, automatic fallback, quotas, or billing enforcement is already deployed.

## Goal

Give QUN AI and QUN Desktop Agent a clear model picker that can use several cloud providers, including providers with free tiers, without loading model weights on the user's computer. Preserve optional local inference, but keep it disabled by default on low-memory devices.

## User experience

Each model entry should display:
- model and provider names, plus capability labels (general, coding, reasoning, vision, fast);
- access class: free-tier, paid API, or user-hosted;
- whether the user has connected that provider;
- a last-checked timestamp for catalogue metadata;
- a plain-language note that provider limits and prices may change.

The selector should include:
1. Selected model — user chooses a specific connected model.
2. Auto (economy) — use a low-cost/free-tier model first and only use enabled fallbacks.
3. Auto (best available) — choose from the user's explicitly enabled providers based on task type and current health.
4. Custom OpenAI-compatible endpoint — for providers not listed in the built-in catalogue.

## Provider adapters

Start with OpenAI-compatible Chat Completions because it covers many gateways. Keep provider-specific adapters behind one internal interface:
- listModels() — static or provider-supplied catalogue; do not assume every API offers a public model list.
- estimateCost() — only when price data is available and current; otherwise show unknown.
- healthCheck() — optional, bounded and non-billing where possible.
- complete() — normalized request/response plus provider/model metadata.
- classifyFailure() — distinguish auth/configuration errors, quota/rate limits, temporary provider failures, and invalid requests.

Potential integrations to evaluate: OpenRouter, Cloudflare Workers AI, Google Gemini API, and any OpenAI-compatible endpoint the user configures. Provider inclusion is not a guarantee of free access. Do not ship or share a global API key in the desktop app.

## Quota-aware routing rules

1. Never route to an unconnected provider or use a key without the user's consent.
2. Never silently route from a free tier to a paid provider.
3. On 429, timeout, or temporary 5xx, retry once at most when safe, then try the next user-enabled fallback.
4. Do not retry 401/403 or invalid-model errors across the whole catalogue; show a clear configuration error.
5. Add a per-provider circuit breaker/cooldown so a rate-limited model is not called repeatedly.
6. Apply request, token, time, and concurrency budgets. Track only the metadata required for usage transparency; do not log prompts or secrets by default.
7. Display the provider and model that actually answered, including when fallback occurred.
8. If no eligible provider remains, stop and explain the next step rather than making an unexpected paid call.

## Credentials and privacy

- Desktop: store each user-owned API key via Electron safeStorage; never expose keys to renderer JavaScript, logs, source control, or the browser page.
- QUN AI Gateway: store provider secrets only as server-side environment secrets. Do not put provider keys into static GitHub Pages or public app bundles.
- Before sending page content to a model, disclose that page text may leave the device and let the user disable page context.
- Provider requests must use HTTPS except local loopback endpoints explicitly enabled by the user.
- Respect provider terms and rate limits; no account rotation or other quota-evasion behavior.

## Free-tier strategy

Free means a provider currently offers a no-cost tier under its own terms; it does not mean unlimited or guaranteed availability. Catalogue metadata should include pricingClass, quotaNotes, termsUrl, lastVerifiedAt, and a confidence/status field. Recheck current terms before surfacing a model as free. If provider quota is exhausted, use only another explicitly enabled provider or stop.

## Rollout

### Phase 1 — safe model picker
- Add provider presets and custom endpoint.
- Keep the model field editable.
- Store per-provider configuration securely.
- Do not auto-fallback yet; show selected provider/model clearly.
- Add a request test button with a small, explicit test prompt.

### Phase 2 — multi-provider fallback
- Add an opt-in fallback list.
- Normalize error categories and apply cooldowns.
- Add usage / provider result metadata.
- Unit-test no-paid-fallback behavior and ensure 401/403 errors don't trigger repeated calls.

### Phase 3 — QUN AI Gateway
- Add server-side provider configuration and model registry.
- Enforce account-level budgets and request limits server-side.
- Keep API secrets out of the client and expose safe model metadata to the UI.
- Deploy only after quota, auth, RLS/secret handling, and failure behavior have been tested.

## Acceptance criteria

- The app starts with no provider selected.
- No request is made without an explicitly configured provider.
- A user can select a model manually and see which model answered.
- Fallback is opt-in and limited to providers the user has enabled.
- A free-tier failure never silently causes paid usage.
- Secrets never appear in logs, renderer state, GitHub, or public pages.
- Documentation distinguishes implemented behavior from planned behavior.