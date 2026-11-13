# QUN Desktop Agent — MVP architecture v0.1

Status: working prototype slice; not production-ready.

## Product direction

One desktop shell, pluggable model APIs, a browser, and a task coordinator. Models may be free, paid, local, or remotely hosted. OpenRouter is one adapter option, not a mandatory provider. The long-term distributed mode reuses QUN Node, QUN Compute, and QUN Agent Core instead of creating a parallel network.

## Current implementation

- Electron shell and embedded BrowserView.
- UI-to-main IPC uses a narrow allowlist.
- Browser navigation is restricted to HTTP(S); pop-up windows are denied in the embedded view and HTTP(S) links open in the system browser.
- Model calls use an OpenAI-compatible Chat Completions request.
- API key encrypted via Electron safeStorage; renderer only sees whether a key exists.
- Current page title, URL and bounded text are attached as context only after a user submits a prompt.
- UI can check the public health endpoint of QUN Agent Core and the local-only QUN Node health endpoint; it does not yet enqueue jobs.
- The system prompt explicitly treats page text as untrusted content.
- No automated form submission, arbitrary shell, or unreviewed side effects in this MVP.

## Existing QUN components to reuse

- Supabase Edge Function qun-agent-core and tables qun_agent_devices, qun_agent_commands.
- qun-node-registry, qun-compute, qun-compute-node.
- services/qun-node local storage, heartbeat and desktop shell.
- Existing QUN compute job queue qun_compute_jobs and node registry qun_nodes.

## Proposed next architecture

1. Add a provider registry with explicit capability flags, endpoint validation, model metadata and optional usage/cost fields.
2. Add a planner that emits typed action proposals; the UI must show a preview and require confirmation for consequential browser actions.
3. Add a browser executor with a strict action allowlist and per-origin permission scopes.
4. Connect the local worker to QUN Agent Core using device pairing and outbound HTTPS only.
5. Add distributed compute task types that are explicitly registered and sandboxed. Nodes advertise capabilities, hardware, availability, and limits; scheduler assigns tasks by capability and consent.
6. Keep API credentials local and encrypted. Never distribute provider API keys to compute nodes.
7. Start with public/synthetic workloads. Do not distribute plaintext private data, secrets, or arbitrary untrusted code to volunteer nodes.

## Distributed network principles

- Local machine is the browser/UI node.
- Remote GPU nodes process only approved, typed jobs (e.g. image/video workflow tasks).
- API provider is selected per task; paid calls require visible configuration and cost awareness.
- Nodes use short leases, heartbeats, job limits, integrity hashes and auditable results.
- Offline/failed nodes must not block local operation; retries and fallbacks are bounded.
- Do not claim unlimited/free compute: every node has quotas and real hardware costs.

## Verification checklist

- [ ] npm install succeeds on a clean machine.
- [ ] npm run check passes.
- [ ] Desktop app opens and embedded browser navigates.
- [ ] API key remains encrypted at rest.
- [ ] API call tested with a user-supplied key and endpoint.
- [ ] QUN Agent Core integration reviewed against current deployed function.
- [ ] Compute job is synthetic and verified end-to-end on two independent nodes.
- [ ] Dependency and security audit completed before public release.

## Local control API

The desktop process exposes a bearer-token-protected development API bound exclusively to `127.0.0.1:47881`. The token is randomly generated and stored under Electron userData, outside the renderer. The API can navigate/read the embedded browser, enumerate visible page controls, click safe controls, type into non-sensitive text fields, and switch the app's Chat/Settings/Network/Browser views. Form submission and likely consequential buttons are blocked. The API rejects non-local browser origins and is not exposed to the LAN.

This is a local development bridge for authorized control; production hardening, explicit approval UX, audit logging, and integration with the existing QUN Agent Core command queue remain follow-up work. It does not create a separate compute network.

## Incremental QUN Agent Core pairing (2026-11-13)

The desktop app now pairs through the existing QUN Agent Core PULT protocol rather than creating a new queue or device registry:

1. The user supplies a valid one-time 64-hex pairing code in the QUN Network settings UI.
2. The desktop app calls `POST /functions/v1/qun-agent-core/pult/pair` with the device ID, name and app version.
3. The one-time returned device token is encrypted with Electron `safeStorage`; it is never returned to renderer JavaScript or written to the audit log.
4. A user-triggered heartbeat calls the existing `/pult/heartbeat` endpoint with the token in the Authorization header.
5. Local audit records are JSONL under the Electron user-data directory and intentionally exclude typed field values, page text, credentials, pairing codes and device tokens.

This slice deliberately does **not** poll `/pult/peek`, claim commands, or execute remote plans. Before queue execution is enabled, implement a visible per-plan approval step in the desktop UI, validate each step against the Core action contract, reject form submissions and consequential actions without explicit confirmation, and report completion/failure through the existing `/pult/claim`, `/pult/reject`, and `/pult/result` contract as appropriate. Do not create a second task queue or duplicate QUN Compute registration.


## Browser-action confirmation and current blocker

Selected consequential clicks (for example delete/pay/buy labels) now trigger an OS-native one-time confirmation dialog that shows the current site host and element label. Publishing, sending, and form submission are still hard-blocked, even if a generic confirmation could be shown. Audit logs record outcome/reason without typed values or page contents.

The current production Core endpoint responds healthy, but its health response reports both MCP and device API keys as not configured. The PULT pairing endpoint uses a one-time code, yet the existing `qun_agent_pairing_codes` table currently has zero active unused codes, and no issuance route was found in the deployed `qun-agent-core` function. Do not bypass this by inserting a code directly. Queue polling/claiming remains disabled until the existing secure code-issuance path is found or implemented and the user explicitly pairs the device.


## Local model, files and extensibility foundation (2026-11-13)

- Local model preset uses Ollama's OpenAI-compatible endpoint at `http://127.0.0.1:11434/v1/chat/completions`; the default starter model is `qwen2.5:1.5b`. Local endpoints do not require or transmit a provider API key. The desktop UI can check Ollama `/api/tags` for installed models. Ollama and model weights are installed separately from the QUN app.
- Assistant answers can be exported through a native Save dialog to Markdown, HTML, PDF, TXT, JSON or CSV. HTML and PDF wrappers escape the answer as text and never execute generated HTML.
- User-authored local memory is stored in `memory.md`, editable in settings, bounded to 12,000 characters, and included as context in later prompts. This is retrieval/context memory, not fine-tuning or autonomous model training.
- Extension storage roots are under Electron userData: `skills/*.md` and `connectors/*.json`. Current implementation can open these directories and list manifests. Extensions are not executed yet; next step is a versioned manifest schema, permissions, user approval, signature/trust policy and a sandboxed runtime.
- Model choice and external provider keys remain under user control; no automatic paid provider or cloud storage is enabled.


## Model and artifact storage strategy

- Do not upload multi-gigabyte model weights into Supabase tables, GitHub, or a generic user file bucket. Keep the starter model cached on the local device; remote model inference should use existing QUN Compute nodes only after capability, consent, quota and licence checks.
- Maintain a lightweight model registry (model ID, source URL, licence, checksum, quantization, RAM/storage estimate, supported tasks) in versioned metadata. Fetch weights from their authoritative upstream and verify checksums before use.
- For user-generated artifacts, use local-first storage by default. Optional cloud sync should be an explicit feature built on the existing QUN Storage/Cloud infrastructure or a configured object store, with per-user access control, encryption, quota, deletion/retention settings and clear indicators when data leaves the device. Never sync secrets or browser credentials.
- Start with metadata and small deliverables; do not enable cloud uploads until a destination, permissions and retention policy are explicitly configured.
