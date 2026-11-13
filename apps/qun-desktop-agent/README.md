# QUN Desktop Agent (MVP 0.1.0)

Open-source desktop AI assistant with an embedded browser and provider-neutral, OpenAI-compatible API support.

## What works in this first slice

- Electron desktop window with a real embedded browser.
- Provider endpoint + model ID configuration (works with compatible free or paid APIs).
- API key encrypted using the operating system's secure storage (Electron safeStorage); key is never exposed to renderer JavaScript.
- Ask the selected model to analyze the current page text.
- Back/forward/reload/navigation and page text extraction.
- Status checks for the deployed QUN Agent Core and local-only QUN Node at 127.0.0.1:8787.
- Status check for the existing QUN Agent Bridge on 127.0.0.1:43127; this detects whether Chrome is connected without duplicating the bridge or claiming browser-control access through this health endpoint.
- Optional pairing with the existing QUN Agent Core `/pult/pair` endpoint using a single-use 64-hex pairing code; the returned device token is encrypted with Electron `safeStorage`.
- Authenticated heartbeat to the existing QUN Core PULT device endpoint; no new queue or database is created.
- Local JSONL audit log for browser navigation/click/type outcomes and Core pairing/heartbeat results. It records hostnames and outcome metadata, not typed field values, API keys, pairing codes or page text.
- A native desktop confirmation dialog for selected consequential clicks (e.g. delete/pay/buy). The development control API is restricted; publishing/submission should only be enabled through a narrowly scoped, site-specific workflow with explicit user authorization, never by globally allowing arbitrary forms.
- Basic URL validation, isolated renderer, no Node.js access in the page/UI renderer.
- No provider is mandatory. No cloud provider is guaranteed to be free. Choose a compatible HTTPS endpoint and verify its free quota and billing terms before use.
- The local Ollama integration is optional and is not enabled by default. This project does not bundle model weights or promise that local inference will run well on low-memory computers. For this device, Ollama was removed because it caused heavy load; use a compatible cloud provider only after checking its quota and pricing.
- Save assistant answers as Markdown, HTML, text, JSON, CSV, or PDF using a native save dialog.
- Explicit local memory (`memory.md`) for user-authored preferences and project notes; it is injected as context, not used to fine-tune model weights.
- Local `skills` (`.md`) and `connectors` (`.json`) extension folders. This is only the storage/discovery foundation; extensions do not execute code automatically.

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

This is an early local MVP, not an unrestricted computer-use agent. Selected consequential clicks require a native one-time confirmation; generic form submission remains blocked except for a narrowly scoped, explicitly authorized workflow. The Core integration currently supports pairing and heartbeat only; it does not yet claim or execute queued commands. It does not run arbitrary shell commands or claim jobs from QUN Compute. The page text is sent to the selected model only when you submit a chat request. The model cannot execute instructions embedded in page content through this interface.

## Roadmap

1. Explicit user-approved browser actions with a strict allowlist.
2. Complete the existing QUN Agent Core queue worker: show a clear local approval dialog before claiming/executing any queued browser plan, then report result through the existing PULT endpoints.
3. Integrate with existing QUN Node / QUN Compute interfaces only after verifying their current registration and job contracts; do not create a parallel worker network.
4. Add a tested, quota-aware QUN AI/cloud provider adapter; keep local inference optional and off by default.
5. Define signed skill and connector manifests, permission scopes, review/disable controls, and sandboxed execution before running extensions.
6. Add artifact generation templates and structured output (HTML/PDF/JSON) with preview and safe path handling.
7. Complete existing QUN Agent Core queue worker only after secure pairing-code issuance and explicit per-plan approval; reuse QUN Node / QUN Compute.
8. Signed builds, automated tests, releases and security review.

## Security notes

Use only APIs and sites you are authorized to access. Do not submit private page contents to an external provider unless you intend to. Electron security defaults are enabled; the embedded browser is isolated from the app preload bridge. Treat this MVP as experimental until dependency and security audits are complete.

License: follow the repository root license; this folder is a prototype.

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

## QUN Core pairing (incremental integration)

Open **Сеть QUN**, enter the existing one-time pairing code issued by the QUN Agent Core pairing flow, and press **Подключить устройство**. The app posts to the existing `/functions/v1/qun-agent-core/pult/pair` endpoint, stores the returned device token encrypted by the OS, then can send an authenticated heartbeat to `/pult/heartbeat`. The pairing code is single-use; never share it in logs or source code. If a pairing code is not available in the current QUN UI, do not insert a code or token directly into the database as a workaround.

Browser actions are logged to the OS user-data directory under `audit/actions.jsonl`. Logs intentionally omit page text, typed values, pairing codes and tokens. Queue polling/claiming and action execution are not enabled in this stage; that requires a visible approval flow before any queued plan is claimed.


## Local model quick start

1. Install Ollama for Windows from the official download page: https://ollama.com/download/windows.
2. In PowerShell run `ollama pull qwen2.5:0.5b` (the first download is around a gigabyte; exact size may vary).
3. Open **Модели и API**, press **Выбрать локальную модель**, then **Проверить Ollama**. The desktop agent uses `http://127.0.0.1:11434/v1/chat/completions` and does not send an API key in local mode.
4. Small models may be slower and less capable than cloud models; use the provider setting to switch back at any time.

## Files, memory and extensions

Every assistant answer has **Сохранить как файл**. The native save dialog supports Markdown, HTML, PDF, text, JSON and CSV. HTML/PDF exports escape answer content rather than executing it. Local memory can be edited under **Память агента**; it is user-controlled context and is not model fine-tuning. Skills and connectors can be placed in the user-data folders opened from settings (`skills/*.md`, `connectors/*.json`). They are not executable plugins yet; a signed manifest, explicit permissions, and sandbox are required before execution.
