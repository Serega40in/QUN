# QUN Desktop Agent (MVP 0.1.0)

Open-source desktop AI assistant with an embedded browser and provider-neutral, OpenAI-compatible API support.

## What works in this first slice

- Electron desktop window with a real embedded browser.
- Provider endpoint + model ID configuration (works with compatible free or paid APIs).
- API key encrypted using the operating system's secure storage (Electron safeStorage); key is never exposed to renderer JavaScript.
- Ask the selected model to analyze the current page text.
- Back/forward/reload/navigation and page text extraction.
- Status checks for the deployed QUN Agent Core and local-only QUN Node at 127.0.0.1:8787.
- Optional pairing with the existing QUN Agent Core `/pult/pair` endpoint using a single-use 64-hex pairing code; the returned device token is encrypted with Electron `safeStorage`.
- Authenticated heartbeat to the existing QUN Core PULT device endpoint; no new queue or database is created.
- Local JSONL audit log for browser navigation/click/type outcomes and Core pairing/heartbeat results. It records hostnames and outcome metadata, not typed field values, API keys, pairing codes or page text.
- Basic URL validation, isolated renderer, no Node.js access in the page/UI renderer.
- No provider is mandatory. The default endpoint is OpenRouter, but any compatible endpoint can be entered.

## Requirements and run

Windows 10/11, macOS or Linux; Node.js 20+; network access for dependency installation and remote model APIs.

Quick Windows install: run PowerShell with this command from the project directory:

    powershell -ExecutionPolicy Bypass -File scripts/install-windows.ps1

The installer installs dependencies, checks JavaScript syntax and creates a desktop shortcut. To start manually from source:

    npm install
    npm start

## Configure a model

Enter an OpenAI-compatible Chat Completions endpoint, model ID and API key. The endpoint may be a free or paid provider. The key is stored encrypted through Electron safeStorage in the OS user-data directory. Do not put keys into source files or commit settings files.

## Current limitations

This is an early local MVP, not an unrestricted computer-use agent. Risky browser actions and form submissions remain blocked. The Core integration currently supports pairing and heartbeat only; it does not yet claim or execute queued commands. It does not run arbitrary shell commands or claim jobs from QUN Compute. The page text is sent to the selected model only when you submit a chat request. The model cannot execute instructions embedded in page content through this interface.

## Roadmap

1. Explicit user-approved browser actions with a strict allowlist.
2. Complete the existing QUN Agent Core queue worker: show a clear local approval dialog before claiming/executing any queued browser plan, then report result through the existing PULT endpoints.
3. Integrate with existing QUN Node / QUN Compute interfaces only after verifying their current registration and job contracts; do not create a parallel worker network.
4. Provider adapters, local model runtimes (e.g. Ollama), cost/usage visibility and fallback routing.
5. Signed builds, automated tests, releases and security review.

## Security notes

Use only APIs and sites you are authorized to access. Do not submit private page contents to an external provider unless you intend to. Electron security defaults are enabled; the embedded browser is isolated from the app preload bridge. Treat this MVP as experimental until dependency and security audits are complete.

License: follow the repository root license; this folder is a prototype.

[executed on device: S40in-LenovoIdeapad-White (0ba7026d-d272-4d74-9960-a5d220722248)]


## ChatGPT / local control bridge

The desktop app exposes a loopback-only control API on `127.0.0.1:47881`. It creates a random 256-bit bearer token in Electron's user-data directory (`control-token.txt`). Never publish this token or place it in renderer JavaScript.

Authenticated endpoints:
- `GET /health` — app and current embedded page status
- `GET /browser/page` — current page title, URL and bounded visible text
- `GET /browser/elements` — visible links, buttons and fields with temporary selectors
- `POST /browser/navigate` — open an HTTP/HTTPS URL
- `POST /browser/action` — back, forward, reload
- `POST /browser/click` — click a visible element; potentially consequential buttons and form submission are blocked
- `POST /browser/type` — fill a normal text field; password, hidden, file and submit inputs are blocked
- `POST /ui/action` — switch between Chat, Settings, QUN Network and Browser

All requests require `Authorization: Bearer <local token>`. The server binds only to IPv4 loopback, rejects browser-origin requests, and has no CORS allowance. Page text is untrusted. This bridge is a development interface, not a production security boundary; keep the token private and do not expose the port to a network.

[executed on device: S40in-LenovoIdeapad-White (0ba7026d-d272-4d74-9960-a5d220722248)]


## QUN Core pairing (incremental integration)

Open **Сеть QUN**, enter the existing one-time pairing code issued by the QUN Agent Core pairing flow, and press **Подключить устройство**. The app posts to the existing `/functions/v1/qun-agent-core/pult/pair` endpoint, stores the returned device token encrypted by the OS, then can send an authenticated heartbeat to `/pult/heartbeat`. The pairing code is single-use; never share it in logs or source code. If a pairing code is not available in the current QUN UI, do not insert a code or token directly into the database as a workaround.

Browser actions are logged to the OS user-data directory under `audit/actions.jsonl`. Logs intentionally omit page text, typed values, pairing codes and tokens. Queue polling/claiming and action execution are not enabled in this stage; that requires a visible approval flow before any queued plan is claimed.
