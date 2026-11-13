# QUN Desktop Agent (MVP 0.1.0)

Open-source desktop AI assistant with an embedded browser and provider-neutral, OpenAI-compatible API support.

## What works in this first slice

- Electron desktop window with a real embedded browser.
- Provider endpoint + model ID configuration (works with compatible free or paid APIs).
- API key encrypted using the operating system's secure storage (Electron safeStorage); key is never exposed to renderer JavaScript.
- Ask the selected model to analyze the current page text.
- Back/forward/reload/navigation and page text extraction.
- Status checks for the deployed QUN Agent Core and local-only QUN Node at 127.0.0.1:8787.
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

This is an early local MVP, not an unrestricted computer-use agent. It does not yet click page elements, submit forms, run shell commands, or claim jobs from QUN Compute. The page text is sent to the selected model only when you submit a chat request. The model cannot execute instructions embedded in page content through this interface.

## Roadmap

1. Explicit user-approved browser actions with a strict allowlist.
2. Connect to existing QUN Agent Core and its device/command queue.
3. Integrate QUN Node / QUN Compute worker registration and job execution.
4. Provider adapters, local model runtimes (e.g. Ollama), cost/usage visibility and fallback routing.
5. Signed builds, automated tests, releases and security review.

## Security notes

Use only APIs and sites you are authorized to access. Do not submit private page contents to an external provider unless you intend to. Electron security defaults are enabled; the embedded browser is isolated from the app preload bridge. Treat this MVP as experimental until dependency and security audits are complete.

License: follow the repository root license; this folder is a prototype.
