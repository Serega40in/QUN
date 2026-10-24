# QUN Studio — cloud renderer setup

Status: provider adapter and mocked API-contract tests are in the repository. This guide is the next operator step; it does **not** mean a GPU endpoint is already provisioned or that the Studio queue is wired to it.

## Current links

- Studio: https://serega40in.github.io/QUN/studio/
- Browser-based prototype: https://serega40in.github.io/QUN/studio/create.html
- RunPod provider adapter: [runpod_comfyui.py](../../tools/qun-node-worker/providers/runpod_comfyui.py)
- Provider tests: [test_runpod_comfyui.py](../../tools/qun-node-worker/providers/test_runpod_comfyui.py)

## Stage 0 — offline preparation (no billing)\n\nRun the [GPU executor preflight](GPU_EXECUTOR_PREFLIGHT.md) before configuring a provider. It performs no network requests and submits no GPU jobs.\n\n## Stage A — create a GPU endpoint only after approving cost

1. Open [RunPod Serverless](https://www.runpod.io/console/serverless) and create a Serverless endpoint using the official [worker-comfyui image](https://github.com/runpod-workers/worker-comfyui).
2. Choose an image/model combination that is actually listed in the current official image tags. A text-to-image endpoint is only the first proof of GPU connectivity; it is not yet a video model.
3. Start with minimum workers set to zero, if available in the current UI. Do not enable always-on workers for this proof of concept.
4. Keep the endpoint private to the API key. Never put the RunPod key in GitHub Pages, browser JavaScript, the QUN repository, or chat messages.
5. Before production, configure the worker's S3 output using its documented `BUCKET_ENDPOINT_URL`, `BUCKET_ACCESS_KEY_ID`, and `BUCKET_SECRET_ACCESS_KEY` variables. Without this, current worker versions return base64 image payloads; QUN deliberately refuses inline media in queue metadata.
6. The current worker's S3 response can contain a presigned URL. Treat it as temporary unless verified otherwise; the production flow must copy the result into QUN-controlled durable storage and record a checksum before marking the job complete.

Official API contract: [worker-comfyui README](https://github.com/runpod-workers/worker-comfyui/blob/main/README.md) and [configuration guide](https://github.com/runpod-workers/worker-comfyui/blob/main/docs/configuration.md).

## Stage B — configure the trusted worker

On a machine or secret manager that is not the public website, configure:

- `RUNPOD_API_KEY`
- `RUNPOD_COMFYUI_ENDPOINT_ID`
- `QUN_COMFYUI_WORKFLOW` — absolute path to a reviewed API-format workflow exported from ComfyUI with `Workflow → Export (API)` and an exact `__QUN_PROMPT__` placeholder in the positive text field.

The adapter exposes `check_endpoint()`, which checks `/health` without submitting a generation job. Only call `generate()` after explicit approval of a render because it submits a GPU job and may incur charges.

## What is still not connected

- QUN Studio UI does not yet create and poll a cloud-render job.
- QUN Compute's current atomic claim function only hands out `health_check` jobs; non-health jobs are intentionally held back.
- A dedicated cloud executor/queue contract and durable QUN Storage ingest must be implemented and tested before any generated output can be treated as a completed QUN Studio job.
- Music generation/provider integration is a separate stage; the browser prototype's synthesized soundtrack is not a Suno integration.

## Acceptance criteria for first cloud proof

- Health check passes without submitting a generation job.
- One explicitly approved image-generation job completes through the real endpoint.
- The result is copied into durable storage; queue metadata stores only URL/object key, checksum, dimensions and provider job ID.
- Failure, timeout, duplicate delivery and expired URLs do not mark the job successful.
