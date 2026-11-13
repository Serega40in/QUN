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
