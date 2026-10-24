# QUN RunPod + ComfyUI executor preflight

This is an offline readiness check only. It does not contact RunPod, create an endpoint, start a worker, or submit a GPU job.

Run from this directory:

```sh
python preflight_runpod.py
```

It reports missing prerequisites without displaying secret values. Once a reviewed ComfyUI API workflow is exported locally using **Workflow → Export (API)**, pass its path:

```sh
python preflight_runpod.py --workflow ./reviewed-workflow.json
```

Use `--strict` in automation to fail until all prerequisites are present. `QUN_OUTPUT_STORAGE_VERIFIED=true` is an explicit operator attestation, not an automatic storage test; do not set it until an end-to-end copy/checksum test has passed.

## Executor setup order

1. Review current provider pricing and set a spending limit/budget alert in the provider console, if available.
2. Prepare an endpoint configuration on paper first. Do not click deploy/start until separately approved.
3. Select a ComfyUI worker image and model that are explicitly listed by the provider. The first image-generation smoke test proves GPU connectivity only; it does not satisfy the eventual 15-second video requirement.
4. Keep minimum workers at zero when supported; avoid always-on capacity.
5. Configure S3-compatible output on the worker. Never return base64 media in queue metadata.
6. Keep API credentials in the trusted executor environment only. Never paste keys into ChatGPT or commit them.
7. Run this offline preflight, then an endpoint health check (network request, no render), then request separate approval before any GPU generation job.
8. Before marking a Studio job complete, copy the output to durable QUN-controlled storage and verify its checksum. Presigned output URLs are not durable storage.

Current state: the RunPod adapter is not connected to the production QUN Compute queue or Studio UI. This preflight does not change that status.
