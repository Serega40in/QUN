# QUN RunPod + ComfyUI adapter

This adapter is the first provider-side implementation step for QUN Animation Studio. It submits a locally reviewed ComfyUI API workflow to an **already-created** RunPod Serverless endpoint and polls the asynchronous job status.

## Safety and current limitations

- Importing the module makes no network calls.
- `generate()` submits a GPU job and may incur charges. Call it only after the user explicitly requests a render.
- The adapter does **not** create, edit, or delete RunPod endpoints.
- Workflow JSON must be exported from ComfyUI using **Workflow → Export (API)** and reviewed locally. QUN never accepts arbitrary workflow JSON from a browser/user job.
- Configure the RunPod worker for S3-compatible output before production. QUN queue results are limited to 100 KB and must contain durable URLs/checksums, not base64 media.
- This adapter is not yet wired into the production queue. QUN currently claims only `health_check` jobs, intentionally preventing non-GPU nodes from accidentally claiming render jobs.

## Configuration

Set these environment variables on the trusted worker only (never GitHub Pages):

- `RUNPOD_API_KEY` — secret API key.
- `RUNPOD_COMFYUI_ENDPOINT_ID` — existing Serverless endpoint ID.
- `QUN_COMFYUI_WORKFLOW` — absolute path to a reviewed API-format workflow JSON with an exact `__QUN_PROMPT__` placeholder in the positive text prompt field.

Example:

```python
from runpod_comfyui import generate

# Explicitly invoked only after the user confirms a paid render.
result = generate("A tiny emerald spirit discovers a music crystal in an enchanted forest.")
print(result)
```

## Command-line checks

From this directory, with the environment variables configured:

```sh
python runpod_comfyui.py health
```

This checks the existing endpoint's health without submitting a generation job. To explicitly submit a paid render:

```sh
python runpod_comfyui.py generate --prompt "A tiny emerald spirit in a magical forest" --confirm-paid-render
```

The render command refuses to run unless `--confirm-paid-render` is present.

## Local tests

From this directory:

```sh
python -m unittest -v
```

No RunPod account, API key, endpoint, or paid job is required for the tests.
