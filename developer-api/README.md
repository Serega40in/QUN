# QUN Developer API MVP

**Status:** implementation added; deployment and live integration tests are not implied by this repository change.

## What is implemented

- `GET /health` — liveness metadata.
- `GET /v1/services` — explicitly labelled service catalog; not all listed products have public APIs.
- `GET /v1/me` — validates a Supabase access token using Supabase Auth, then reads the caller's own `public.profiles` row using the caller's token (RLS remains in force).
- `GET /openapi.json` — machine-readable OpenAPI 3.1 document for REST routes.
- `POST /mcp` — stateless JSON-RPC MCP endpoint with `initialize`, `ping`, `tools/list`, and `tools/call`. Tools: `qun_list_services`, `qun_whoami`.

This MVP is read-only. It does not create API keys, mutate QUN products, publish apps, expose service-role credentials, or claim unsupported product endpoints exist.

## Required Cloudflare Worker settings

Set these as Worker secrets/variables in the Cloudflare dashboard or with Wrangler:

- `SUPABASE_URL`: the QUN Supabase project URL.
- `SUPABASE_ANON_KEY`: the project's publishable/anon key. This key is public by design; never use a service-role key here.
- Optional `ALLOWED_ORIGIN`: restrict browser CORS to one trusted origin. CORS is not authentication.

Do not commit secrets. Supabase access tokens are sent in the `Authorization: Bearer <access-token>` header and validated by Supabase Auth on each authenticated request.

## Local development

```sh
npm install
npm run dev
``

Wrangler will report the local URL. Test:

```sh
curl -i http://localhost:8787/health
curl -i http://localhost:8787/v1/services
curl -i http://localhost:8787/v1/me
curl -i http://localhost:8787/openapi.json
``

The unauthenticated `/v1/me` request should return HTTP 401. To test with a real session, use a valid Supabase access token from a QUN login session; do not paste tokens into issues or logs.

## MCP smoke test

The endpoint is intended for MCP clients, not for opening directly in a browser. Send JSON-RPC over HTTP:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0.0"}}}
```

Then send `tools/list`. For `qun_whoami`, include the same bearer access token in the HTTP request. Configure clients to use the deployed `https://<worker-host>/mcp` URL with Streamable HTTP support.

## First deploy

1. Create a Worker named `qun-developer-api` or connect this folder to a Cloudflare Worker.
2. Configure `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
3. Run `npm install`, `npm run typecheck`, `npm run test`, then `npm run deploy`.
4. Smoke-test health, 401 handling, valid-session identity, and MCP `tools/list`.
5. Only then publish the endpoint URL in QUN Developer docs.

## Security notes and next steps

- Profile lookup uses the caller JWT, not an elevated service key; verify the existing profile RLS policy in a live test.
- Add rate limiting, structured audit logs, request IDs, and stricter CORS for browser use before broad public launch.
- Next API milestone: scoped developer API keys with hashed-at-rest secrets, one-time secret display, revocation, expiry, usage tracking, and server-side scope enforcement. Do not implement keys as long-lived raw database values.
- MCP remote auth support varies by client. This MVP uses bearer-token authentication for protected tools; an OAuth authorization flow for third-party ChatGPT clients is a separate milestone.


## Build validation

The Worker uses standard Web Worker TypeScript library types, so the build does not depend on a date-pinned Cloudflare type package. CI runs TypeScript type-checking and the smoke-test suite on pull requests.
