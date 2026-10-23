"""RunPod Serverless adapter for QUN's reviewed ComfyUI workflows.

No request is made at import time. A call can incur GPU charges, so callers must
only invoke generate() after the user has explicitly requested a render.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


class RunPodError(RuntimeError):
    pass


def _request_json(url: str, payload: dict[str, Any] | None, api_key: str, timeout: int = 30) -> dict[str, Any]:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method="GET" if body is None else "POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read(5_000_001)
            if len(raw) > 5_000_000:
                raise RunPodError("RunPod response exceeded 5 MB; configure S3 output in the worker.")
            return json.loads(raw or b"{}")
    except urllib.error.HTTPError as exc:
        detail = exc.read(1500).decode("utf-8", "replace")
        raise RunPodError(f"RunPod HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RunPodError(f"RunPod connection failed: {exc.reason}") from exc


def _replace_prompt(value: Any, prompt: str) -> Any:
    """Replace only exact placeholder values in a locally reviewed workflow."""
    if isinstance(value, dict):
        return {k: _replace_prompt(v, prompt) for k, v in value.items()}
    if isinstance(value, list):
        return [_replace_prompt(v, prompt) for v in value]
    return prompt if value == "__QUN_PROMPT__" else value


def generate(
    prompt: str,
    workflow_path: str | Path | None = None,
    *,
    api_key: str | None = None,
    endpoint_id: str | None = None,
    timeout_seconds: int = 900,
    poll_seconds: float = 2.0,
) -> dict[str, Any]:
    """Run a locally allow-listed ComfyUI API workflow via RunPod's async endpoint.

    The endpoint must already exist. This function does not create cloud resources.
    Output files should be configured to upload to durable S3-compatible storage;
    raw base64 media is deliberately not returned as a QUN job result.
    """
    key = api_key or os.environ.get("RUNPOD_API_KEY", "")
    endpoint = endpoint_id or os.environ.get("RUNPOD_COMFYUI_ENDPOINT_ID", "")
    path_value = workflow_path or os.environ.get("QUN_COMFYUI_WORKFLOW")
    if not key or not endpoint or not path_value:
        raise RunPodError(
            "Configure RUNPOD_API_KEY, RUNPOD_COMFYUI_ENDPOINT_ID and QUN_COMFYUI_WORKFLOW first."
        )
    if not prompt or len(prompt) > 12000:
        raise RunPodError("Prompt must contain 1–12000 characters.")
    path = Path(path_value).expanduser()
    if not path.is_file():
        raise RunPodError(f"Reviewed workflow file not found: {path}")
    try:
        workflow = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RunPodError(f"Could not read workflow JSON: {exc}") from exc
    if not isinstance(workflow, dict) or not workflow:
        raise RunPodError("Workflow must be a non-empty ComfyUI API-format JSON object.")

    workflow = _replace_prompt(workflow, prompt)
    base = f"https://api.runpod.ai/v2/{endpoint}"
    submitted = _request_json(base + "/run", {"input": {"workflow": workflow}}, key)
    job_id = submitted.get("id")
    if not isinstance(job_id, str) or not job_id:
        raise RunPodError("RunPod did not return a job ID.")

    deadline = time.monotonic() + max(1, min(timeout_seconds, 3600))
    while time.monotonic() < deadline:
        time.sleep(max(0.5, min(poll_seconds, 15)))
        status = _request_json(base + "/status/" + job_id, None, key)
        state = status.get("status")
        if state == "COMPLETED":
            output = status.get("output")
            if not isinstance(output, dict):
                raise RunPodError("ComfyUI completed without a structured output.")
            # The QUN queue has a 100 KB result limit. Refuse inline base64 blobs:
            # use RunPod worker's S3 output configuration and return durable URLs.
            serialized = json.dumps(output)
            if len(serialized) > 90000 or "image" in serialized.lower() and "base64" in serialized.lower():
                raise RunPodError("Output appears to contain inline media. Configure S3 output and retry.")
            return {"provider": "runpod-comfyui", "provider_job_id": job_id, "output": output}
        if state in {"FAILED", "CANCELLED", "TIMED_OUT"}:
            error = status.get("error") or state
            raise RunPodError(f"RunPod job {state.lower()}: {str(error)[:1200]}")
    raise RunPodError(f"RunPod job timed out after {timeout_seconds} seconds (job ID {job_id}).")
