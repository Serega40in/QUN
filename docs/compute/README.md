# QUN Compute 0.1

QUN Compute is the first shared job queue for the QUN distributed compute layer.

## Current infrastructure
- GitHub Pages: frontend only.
- Supabase: authentication, metadata, queue, node registry and job state.
- Existing QUN Node registry remains the source of node identity.
- ComfyUI is not embedded in Supabase; a trusted worker must run it and poll the queue.

## Current status
- `qun_compute_jobs` table and atomic `qun_claim_compute_job(uuid)` function; queue-safety migration adds bounded attempts, three-minute leases, heartbeat renewal and stale-job recovery.
- Edge Function `qun-compute` deployed with JWT verification enabled.
- Dashboard: `/compute/`
- Supported API actions: `create_job`, `my_jobs`, `cancel_job`, `node_heartbeat`, `claim_job`, `heartbeat_job`, `complete_job`, `fail_job`.
- Job result metadata is not the actual media file. Store generated files in durable object storage and save a durable URL/checksum in `result`.

## Security rules
- Never expose Supabase service-role keys in GitHub Pages or node agents.
- Node credentials are long random tokens; store only SHA-256 hashes server-side.
- Only `health_check` jobs are claimable in the current worker version. Use the Studio option “Проверка очереди (без генерации)” to smoke-test the queue. Image/video/audio and ComfyUI jobs stay queued until a compatible executor is explicitly enabled.
- Job claims are atomic; each claim increments `attempt_count` and receives a three-minute lease. Worker heartbeats renew the lease. Expired leases are retried up to `max_attempts` (default 3), then marked failed.
- Completion/failure updates are accepted only from the node currently assigned to a running job; stale workers cannot overwrite a requeued job.
- Only run explicitly allow-listed workflows. Do not execute arbitrary shell commands or accept arbitrary workflow files from untrusted users on a worker.
- Node owners must opt in and be able to pause/revoke a worker.
- GPU generation is not active until a real worker with suitable hardware is connected.

## Next steps
1. Implement and test a QUN Node worker client that authenticates with an enrolled node token.
2. Add capability heartbeat (CPU/RAM/GPU, ComfyUI URL/version, free disk) with strict input validation.
3. Connect ComfyUI using a private worker-side endpoint; never expose its unauthenticated API publicly.
4. Configure durable storage, integrity hashes, quotas and retention.
5. Add queue limits, per-user rate limits and observability before opening the network to outside contributors.

## QUN Living Compute — browser prototype (2026-10-29)
- Browser UI: https://serega40in.github.io/QUN/compute/
- New Supabase Edge Function: `qun-browser-compute` (manual access-token validation through Supabase Auth).
- New tables: `qun_browser_preferences`, `qun_browser_challenges`, `qun_browser_contributions`; RLS enabled and direct grants revoked from `anon` and `authenticated`.
- Existing QUN ID username/password login is reused via `qun-auth`.
- Explicit opt-in is required. The browser runs a small SHA-256 proof-of-work challenge only inside this page, pauses between tasks while the page is hidden, and can be stopped at any time.
- Successful proofs receive **QUN Compute Credits**, internal test units only; they are not cryptocurrency and have no monetary value.
- This proves browser-side computation and authenticated contribution accounting, not yet useful paid compute. It does not execute arbitrary remote code or process personal files.
- This browser MVP is separate from the existing `qun_compute_jobs` queue. Integration with useful allowlisted tasks requires a task contract, isolation, verification, abuse limits and browser integration tests first.
