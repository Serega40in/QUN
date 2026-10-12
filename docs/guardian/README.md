# QUN Guardian

QUN Guardian is the planned control center for QUN project inventory, backup visibility, integrity checks, and future distributed infrastructure.

## Current interface

Static prototype: `docs/guardian/index.html`

GitHub Pages URL (after deployment): https://serega40in.github.io/QUN/guardian/

**Important:** this page is a static dashboard prototype. It does not connect to Supabase, run backups, or execute privileged operations. Never place credentials, service-role keys, private keys, database dumps, or private messages in this directory.

## Project priorities

- Active: QUN Messenger
- Active: QUN AI
- Foundation: QUN Core and shared infrastructure
- Planned/inventory: QUN Platform
- **Paused by decision on 2026-10-12:** QUN MAP. Preserve existing code and notes; do not spend active development effort on this branch unless explicitly resumed.

## Backup implementation plan

1. Inventory every database, bucket, repository, workflow, and external document store.
2. Configure database exports and separate object-storage backups.
3. Keep encrypted copies in two independent storage providers with separate credentials.
4. Maintain an offline copy and an inventory/manifest of every archive.
5. Verify checksums and regularly test restoration into an isolated environment.
6. Add a protected backend/API for real status, backup jobs, verification, and restore approvals.
7. Add Telegram notifications/control only after authentication, authorization, audit logging, and rate limits are in place.

## Distributed storage and compute — research track

Target architecture should avoid a single point of failure and should not require every device to hold the entire system. Explore encrypted chunking, erasure coding or replication, signed manifests, content hashes, node health checks, repair/rebalancing, retention policies, and independent key management. For distributed compute, use sandboxed workers, explicit task permissions, reproducible or verifiable outputs, quotas, and abuse prevention.

A blockchain may help with append-only audit records or coordination, but it does not by itself guarantee availability, confidentiality, correct computation, or data durability. Design for measurable recovery objectives rather than promising an absolutely unbreakable system.

## Suggested first production milestones

- Define RPO/RTO for Messenger and QUN AI.
- Produce one complete test backup and restore.
- Add independent second-cloud storage.
- Add offline encrypted archive.
- Connect the dashboard to a protected server-side status API.
