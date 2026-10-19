# QUN Compute 0.1

QUN Compute is the first shared job queue for the QUN distributed compute layer.

## Current infrastructure
- GitHub Pages: frontend only.
- Supabase: authentication, metadata, queue, node registry and job state.
- Existing QUN Node registry remains the source of node identity.
- ComfyUI is not embedded in Supabase; a trusted worker must run it and poll the queue.

## Current status
- `qun_compute_jobs` table and atomic `qun_claim_compute_job(uuid)` function created by migration `qun_compute_queue_v01`.
- Edge Function `qun-compute` deployed with JWT verification enabled.
- Dashboard: `/compute/`
- Supported API actions: `create_job`, `my_jobs`, `cancel_job`, `node_heartbeat`, `claim_job`, `complete_job`, `fail_job`.
- Job result metadata is not the actual media file. Store generated files in durable object storage and save a durable URL/checksum in `result`.

## Security rules
- Never expose Supabase service-role keys in GitHub Pages or node agents.
- Node credentials are long random tokens; store only SHA-256 hashes server-side.
- Only run explicitly allow-listed workflows. Do not execute arbitrary shell commands or accept arbitrary workflow files from untrusted users on a worker.
- Node owners must opt in and be able to pause/revoke a worker.
- GPU generation is not active until a real worker with suitable hardware is connected.

## Next steps
1. Implement and test a QUN Node worker client that authenticates with an enrolled node token.
2. Add capability heartbeat (CPU/RAM/GPU, ComfyUI URL/version, free disk) with strict input validation.
3. Connect ComfyUI using a private worker-side endpoint; never expose its unauthenticated API publicly.
4. Configure durable storage, integrity hashes, quotas and retention.
5. Add queue limits, per-user rate limits and observability before opening the network to outside contributors.
