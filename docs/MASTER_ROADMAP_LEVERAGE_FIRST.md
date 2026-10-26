# QUN Master Roadmap — leverage-first execution

> Status: strategy and execution map, not a claim that every subsystem is production-ready.
> Operating rule: build in parallel only where interfaces are stable; integrate through reviewed PRs and passing checks. Do not merge to `main` without validation.

## North-star outcome

QUN is a coherent, secure, lightweight digital ecosystem: one user identity and design language, dependable APIs and data contracts, useful products, and an adaptive world that reveals detail near the observer without loading the entire universe into memory.

## Leverage-ranked priorities

### P0 — Engineering control plane and safety (unblocks everything)
1. Keep `main` releasable: branch/PR workflow, CI status, review checklist, secrets isolation, reproducible releases.
2. Inventory every app, workflow, backend, dependency, environment variable, data store, and deployment target.
3. Establish a single capability/status matrix: prototype / tested / beta / production. Never label an unverified capability as complete.
4. Add regression tests for critical user journeys and cross-project smoke tests.
**Done when:** each change is traceable, tests are repeatable, release rollback is documented, and no release secret is exposed to untrusted PR code.

### P1 — Shared platform contracts (highest product leverage)
1. Define versioned API conventions, error model, pagination, rate limits, request IDs, health checks, and compatibility policy.
2. Define QUN ID/account/profile contract and authorization boundaries. Reuse identity only where authentication can be safely shared; never couple all products to one privileged token.
3. Define shared UI/design tokens, navigation conventions, accessibility, localization, and mobile-first responsive rules.
4. Document service ownership and data boundaries; prefer small replaceable services over a monolith.
**Done when:** new QUN modules can integrate without inventing their own auth, UI primitives, logging, or error semantics.

### P2 — Security and trust baseline
1. Threat-model authentication, storage, uploads, node workers, API/MCP tools, and supply chain.
2. Audit authorization and RLS policies; test cross-user access denial, private file access, rate limiting, and input validation.
3. Keep secrets out of source, logs, client bundles, issues, and artifacts. Least privilege for CI and deployment.
4. Publish vulnerability reporting and dependency update policy; add dependency and secret scanning where available.
5. Treat QUN Core/blockchain as experimental until signatures, replay/double-spend protection, networking, consensus, recovery, and independent review are demonstrated.
**Done when:** critical threat cases have tests and documented residual risks; no claim of independent audit unless one actually occurred.

### P3 — First useful, reliable products
Workstreams can run in parallel with separate branches/PRs:
- **Messenger Web (#33):** voice notes and secure file attachments first; then WebRTC 1:1 audio/video with real signaling, permission states, NAT/TURN strategy, and browser tests.
- **QUN Node / Network Engineering Loop (#14):** verify local object integrity, safe task queue, replication/resync, worker lifecycle and observability; explicitly distinguish local tests from a genuinely distributed network.
- **Discovery / QUN World (#16, #32 and related PRs):** finish a real-browser tested playable loop, meaningful progression, accessible touch controls, save/restore, performance budgets, and graceful fallback.
- **VPN (#34):** isolated WireGuard team access only after host/infrastructure inventory; no paid services, secret configs in Git, or production network changes without approval.
- **Early Testers (#28):** simple onboarding, privacy-safe feedback, known limitations, and an issue triage loop.
**Done when:** each product has one complete end-to-end user journey verified on real browsers/devices and documented limitations.

### P4 — QUN World Engine: progressive, observer-centered rendering
1. Begin with a lightweight 2D/WebGL-capable browser prototype; don't require heavy local AI models or high-end GPU.
2. Use deterministic world seeds, chunk/region streaming, level of detail (LOD), view/frustum culling, object pooling, and lazy asset loading.
3. Prioritize by observer distance, visibility, interaction, and available frame budget. Load low-detail silhouettes first, then nearby geometry, textures, particles, and audio.
4. Cache generated/loaded chunks with strict memory limits and eviction; use workers only for measured CPU-heavy work.
5. Keep simulation deterministic where useful, but allow per-user discoveries and state to differ. Do not claim literal quantum/observer effects.
6. Establish budgets: target smooth interaction on modest Android/Intel integrated graphics; adapt quality to device and frame time; reduce effects before reducing usability.
7. Test cold start, low-memory devices, network loss, rapid movement, repeated chunk visits, and long sessions.
**Done when:** the world appears continuous, only nearby detail is loaded, memory stays bounded, and frame-time budgets are measured rather than guessed.

### P5 — Ecosystem expansion
Only after shared contracts and reliable core journeys:
- QUN AI / creative cloud workflows, Market, Mini Apps, Search, Publisher/News, Wallet/P2P, QUN ID, Node/Storage/Guardian, developer hub, and regional/localized deployments.
- Wallet/coin features remain test-only until threat model, key custody, legal review, abuse controls, and independent security review are complete.
- AI generation should be cloud-first and opt-in, with clear quotas, queue state, storage retention, and cost controls.
**Done when:** every module has a real user need, an owner, an operational budget, privacy/security review, and integration tests.

## Parallel execution model

Run independent workstreams concurrently only behind explicit interfaces:
A. Platform/CI/security baseline.
B. Messenger Web voice/files, then calls.
C. Node queue/reliability and verification.
D. Discovery gameplay and World Engine prototype.
E. Community/tester onboarding and feedback.
F. VPN inventory and safe implementation plan.

Each stream uses a feature branch and PR. Avoid simultaneous edits to shared files; designate one integration owner for shared contracts. Merge order: CI/security foundations → contracts → product PRs → release. A green CI run is necessary but not sufficient; verify user journey and deployment after merge.

## Immediate next actions

1. Review all open PRs and check runs; do not merge solely to clear the queue.
2. Verify PR #32's real-browser Discovery test and inspect existing open feature PRs.
3. Break down #33 and #34 into independently testable PRs without duplicating work.
4. Add World Engine prototype as a separate, performance-budgeted module; don't rewrite the main page or existing product routes.
5. Publish status updates with evidence: commit/PR, test result, deployment URL, known limitations.

## Non-negotiable constraints

- No paid cloud, domains, or infrastructure without explicit approval.
- No arbitrary remote code execution in Node workers.
- No private keys, tokens, personal data, or production credentials in Git.
- No direct-to-main shortcut; no unreviewed mass merges.
- Preserve existing routes and working features; changes must be additive unless a migration is reviewed.
- "Production-ready", "secure", "decentralized", "audited", and "perfect" require evidence. Improve continuously; do not make unsupported guarantees.
