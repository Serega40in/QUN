# QUN Distributed Backend — Architecture Proposal v0.1

**Status:** proposal / research implementation, not production infrastructure  
**Decision date:** 2026-10-12  
**Scope:** QUN Messenger, QUN AI, QUN Core, future QUN services  
**Paused:** QUN MAP is out of active scope until explicitly resumed.

## 1. Goal and non-goals

Goal: reduce single-provider dependency, improve recoverability, and let independent nodes contribute storage and compute under explicit security and resource limits.

Non-goals:
- Do not promise literally zero cost, zero downtime, or an unbreakable system.
- Do not move all services into a peer-to-peer network in one migration.
- Do not replicate every user's private data to every device.
- Do not treat a blockchain as a database, backup system, or proof that a computation is correct.
- Do not expose database credentials, service-role keys, private messages, or signing keys to browser code or Telegram.

Volunteer compute/storage is not truly free: nodes consume electricity, bandwidth, hardware lifetime, and operator time. Availability depends on how many independent nodes are online and willing to serve a given task.

## 2. Recommended hybrid architecture

Keep a minimal control plane, but avoid making it the sole holder of data:
- **Identity/control plane:** QUN ID and authorization initially remain compatible with the current Supabase Auth setup. Define portable user and service identities so a future provider migration is possible.
- **Application APIs:** versioned service APIs; business logic must not be embedded only in GitHub Pages or the browser.
- **Primary data:** PostgreSQL/Supabase remains the current operational source during the first migration phase. Add an independent encrypted backup and test restore before any database migration.
- **Object storage:** keep originals in the current store while adding encrypted backup copies in independent storage.
- **Distributed storage layer:** future content-addressed encrypted chunks, signed manifests, replication/erasure coding, node health checks, repair/rebalancing and retention policy.
- **Compute layer:** opt-in worker nodes running sandboxed, allow-listed tasks; no arbitrary shell execution, no direct access to production secrets or raw user data.
- **Audit/coordination:** append-only signed events and hashes. Consider a blockchain only if independent operators need shared consensus; do not introduce a token/chain merely for branding.
- **Operations:** QUN Guardian reads from a protected backend status API, shows freshness/health and requests approved jobs. Static GitHub Pages remains a UI only.

## 3. Data classes and privacy boundaries

Classify every dataset before distributing it:
1. **Public:** published website assets, public documentation, public model artefacts.
2. **Internal:** source code, deployment manifests, non-secret operational metadata.
3. **Confidential:** customer records, profiles, private project files.
4. **Highly sensitive:** authentication material, encryption keys, private messages, legal/financial records.

Only public or explicitly approved, encrypted content should be placed on volunteer nodes. Private messages should be end-to-end encrypted before a decentralized storage design is considered; storage replication alone is not end-to-end encryption. Keep key recovery separate from data storage. Never distribute plaintext secrets.

## 4. Distributed storage design

Proposed building blocks:
- Content-addressed objects identified by cryptographic hashes.
- A signed manifest per snapshot: object IDs, sizes, schema/app version, creation time, encryption/key version, retention class and hashes.
- Client-side or trusted-ingest encryption before objects reach untrusted nodes.
- Chunking for large objects; deduplication only where it does not leak sensitive information.
- Replication for simpler first prototype; evaluate erasure coding only after measuring repair complexity and bandwidth.
- Independent node identities, authenticated transport, rate limits and quotas.
- Periodic scrubbing: read samples/full objects, verify hashes and report corruption.
- Repair when replicas disappear; no success state until the required durability threshold is met.
- Explicit deletion/retention and legal holds. Immutable retention must not silently conflict with privacy or deletion obligations.

Do not implement a custom cryptographic algorithm. Use mature libraries and reviewed protocols.

## 5. Distributed compute design

Worker lifecycle:
1. API creates a typed task with versioned schema, resource limits, deadline and allowed inputs.
2. Scheduler chooses eligible workers based on capability, availability, reputation/health and quota.
3. Worker fetches only the minimum necessary input, preferably an encrypted or privacy-preserving payload.
4. Run task in a sandbox/container/WASM runtime with no host secrets and restricted network access.
5. Worker returns output, logs metadata, task version and a digest.
6. Verifier checks schema, signatures and, where practical, recomputes or cross-checks the result on independent workers.
7. Scheduler records success/failure and retries idempotent tasks safely.

Never execute arbitrary code supplied by a peer on the host. LLM inference may require large RAM/VRAM and may be much slower on volunteer hardware; scheduling must account for model size, data locality, latency and node churn. Some tasks cannot be independently verified cheaply.

## 6. Availability, durability and cost

Design measurable targets instead of claiming 100% availability:
- Define RPO (maximum acceptable lost changes) and RTO (maximum acceptable recovery time) separately for Messenger, AI and static content.
- Keep at least one offline backup and one independently administered off-site backup before introducing peer storage.
- Monitor replica count, last successful scrub, restore-test age, worker failure rate, queue delay and storage/egress costs.
- Use graceful degradation: if volunteer compute is unavailable, queue non-urgent work or fall back to an explicitly budgeted provider/local node.
- If every provider and every node disappears, no architecture can guarantee service continuity. Independent copies and geographically/operator-diverse nodes reduce the risk; they do not make it zero.
- Start with a small pilot and publish real cost and availability measurements.

## 7. Migration phases and acceptance criteria

### Phase 0 — Inventory and recovery baseline
- Inventory every repository, database, Supabase Storage bucket, Edge Function, secret name, domain and deployment workflow.
- Create encrypted backup exports; copy them to a second provider and offline media.
- Restore a backup into an isolated test project.
- Document RPO/RTO and retention policy.
**Exit criterion:** a documented restore test succeeds without using the live production database.

### Phase 1 — Guardian operations API
- Add a small server-side control API with authentication, role-based access, audit log, rate limits and explicit confirmation for destructive actions.
- UI obtains live status only from this API; secrets stay server-side.
- Add status, backup-job creation, verification and alert history.
**Exit criterion:** an unauthorized caller cannot start jobs or read private operational details; no privileged key appears in browser bundles.

### Phase 2 — Portable data and storage adapter
- Define versioned export/import formats and provider-neutral storage interfaces.
- Store signed manifests and content hashes.
- Build a local test node and a second independent storage target.
**Exit criterion:** restore a snapshot using the manifest without depending on the original storage provider.

### Phase 3 — Small distributed storage testnet
- Recruit a small number of trusted, independently operated nodes.
- Store only public test data and synthetic private test fixtures encrypted before upload.
- Simulate node loss, corruption, network partitions, malicious responses and key rotation.
**Exit criterion:** data remains retrievable at the agreed replica threshold and corrupt replicas are detected/repaired.

### Phase 4 — Opt-in compute testnet
- Start with non-sensitive, idempotent tasks such as media conversion or public-data processing.
- Add sandboxing, quotas, task signing, duplicate execution and verification.
- Benchmark against one local machine and a hosted service.
**Exit criterion:** malicious task input cannot escape the sandbox; results and failure rates are measurable.

### Phase 5 — Gradual production adoption
- Move one low-risk service at a time only after security review, backup restore drills, load tests and rollback procedures.
- Keep a conventional recovery path until decentralized operation is proven.
- Do not migrate authentication, private messaging or key management first.

## 8. First implementation backlog

1. Inventory and backup/restore runbook.
2. QUN Guardian API contract: health, components, backup jobs, archive manifests, verification runs, audit events.
3. Local storage-node prototype with encrypted objects and signed manifests.
4. Fault-injection test harness: node offline, corrupted block, expired key, interrupted upload.
5. Compute worker prototype for one allow-listed public-data task.
6. Threat model and security review before any real user data is involved.

## 9. Threat model checklist

Threats to test: node disappearance; provider account compromise; malicious node returning wrong bytes; replayed/stale manifests; compromised worker; task injection; sybil nodes; denial of service; metadata leakage; key loss; ransomware; accidental deletion; corrupted backup; supply-chain compromise; and malicious administrator.

Controls must include least privilege, independent credentials, key rotation/recovery, signed manifests, verified restore drills, audit logs, rate limits, reproducible builds where practical, and incident response instructions.

## 10. Decision

Proceed with a hybrid-first, decentralization-ready architecture. First make recovery reliable, then distribute encrypted storage, then add sandboxed compute. Keep current QUN Messenger/QUN AI functionality operational during migration. QUN MAP remains paused.
