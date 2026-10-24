"""RunPod Serverless adapter for QUN's reviewed ComfyUI workflows.

No request is made at import time. A call can incur GPU charges, so callers must
only invoke generate() after the user has explicitly requested a render.
"""
from __future__ import annotations
import json, os, time, urllib.error, urllib.request
from pathlib import Path
from typing import Any

class RunPodError(RuntimeError):
    pass

def _request_json(url: str, payload: dict[str, Any] | None, api_key: str, timeout: int = 30) -> dict[str, Any]:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
    if body is not None: headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method="GET" if body is None else "POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read(5_000_001)
            if len(raw) > 5_000_000: raise RunPodError("RunPod response exceeded 5 MB; configure S3 output.")
            value = json.loads(raw or b"{}")
            if not isinstance(value, dict): raise RunPodError("RunPod returned non-object JSON.")
            return value
    except urllib.error.HTTPError as exc:
        raise RunPodError(f"RunPod HTTP {exc.code}: {exc.read(1500).decode('utf-8', 'replace')}") from exc
    except urllib.error.URLError as exc:
        raise RunPodError(f"RunPod connection failed: {exc.reason}") from exc

def _replace_prompt(value: Any, prompt: str) -> Any:
    if isinstance(value, dict): return {k: _replace_prompt(v, prompt) for k, v in value.items()}
    if isinstance(value, list): return [_replace_prompt(v, prompt) for v in value]
    return prompt if value == "__QUN_PROMPT__" else value

def _contains_inline_media(value: Any, parent_key: str = "") -> bool:
    if isinstance(value, dict):
        media_type = str(value.get("type", "")).lower()
        if media_type == "base64" and value.get("data"): return True
        if media_type == "s3_url":
            data = value.get("data")
            if not isinstance(data, str) or not data.startswith(("https://", "http://")): return True
        return any(_contains_inline_media(v, str(k).lower()) for k, v in value.items())
    if isinstance(value, list): return any(_contains_inline_media(v, parent_key) for v in value)
    if not isinstance(value, str): return False
    value = value.strip()
    if value.startswith(("data:image/", "data:video/", "data:audio/")): return True
    if parent_key in {"image", "images", "audio", "video", "base64", "b64"}:
        return not value.startswith(("https://", "http://"))
    return len(value) > 2048 and not value.startswith(("https://", "http://"))


def check_endpoint(*, api_key: str | None = None, endpoint_id: str | None = None) -> dict[str, Any]:
    """Check an existing RunPod endpoint's health without submitting a generation job."""
    key = api_key or os.environ.get("RUNPOD_API_KEY", "")
    endpoint = endpoint_id or os.environ.get("RUNPOD_COMFYUI_ENDPOINT_ID", "")
    if not key or not endpoint:
        raise RunPodError("Configure RUNPOD_API_KEY and RUNPOD_COMFYUI_ENDPOINT_ID first.")
    result = _request_json(f"https://api.runpod.ai/v2/{endpoint}/health", None, key)
    return {"provider": "runpod-comfyui", "endpoint_id": endpoint, "health": result}

def generate(prompt: str, workflow_path: str | Path | None = None, *, api_key: str | None = None,
             endpoint_id: str | None = None, timeout_seconds: int = 900, poll_seconds: float = 2.0) -> dict[str, Any]:
    """Submit a reviewed ComfyUI API workflow to an existing RunPod endpoint.

    This does not create resources. The endpoint must store media in durable
    S3-compatible storage; inline base64 media is rejected.
    """
    key = api_key or os.environ.get("RUNPOD_API_KEY", "")
    endpoint = endpoint_id or os.environ.get("RUNPOD_COMFYUI_ENDPOINT_ID", "")
    path_value = workflow_path or os.environ.get("QUN_COMFYUI_WORKFLOW")
    if not key or not endpoint or not path_value:
        raise RunPodError("Configure RUNPOD_API_KEY, RUNPOD_COMFYUI_ENDPOINT_ID and QUN_COMFYUI_WORKFLOW first.")
    if not prompt or len(prompt) > 12000: raise RunPodError("Prompt must contain 1–12000 characters.")
    path = Path(path_value).expanduser()
    if not path.is_file(): raise RunPodError(f"Reviewed workflow file not found: {path}")
    try: workflow = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc: raise RunPodError(f"Could not read workflow JSON: {exc}") from exc
    if not isinstance(workflow, dict) or not workflow:
        raise RunPodError("Workflow must be a non-empty ComfyUI API-format JSON object.")
    workflow = _replace_prompt(workflow, prompt)
    base = f"https://api.runpod.ai/v2/{endpoint}"
    submitted = _request_json(base + "/run", {"input": {"workflow": workflow}}, key)
    job_id = submitted.get("id")
    if not isinstance(job_id, str) or not job_id: raise RunPodError("RunPod did not return a job ID.")
    deadline = time.monotonic() + max(1, min(timeout_seconds, 3600))
    while time.monotonic() < deadline:
        time.sleep(max(0.5, min(poll_seconds, 15)))
        status = _request_json(base + "/status/" + job_id, None, key)
        state = status.get("status")
        if state == "COMPLETED":
            output = status.get("output")
            if not isinstance(output, dict): raise RunPodError("ComfyUI completed without structured output.")
            if output.get("status") in {"FAILED", "ERROR", "error"} or output.get("errors"):
                raise RunPodError("ComfyUI worker reported an output error.")
            if _contains_inline_media(output):
                raise RunPodError("Output contains inline media. Configure S3-compatible output and retry.")
            if len(json.dumps(output)) > 90000: raise RunPodError("Output metadata exceeds QUN's safe result limit.")
            return {"provider": "runpod-comfyui", "provider_job_id": job_id, "output": output}
        if state in {"FAILED", "CANCELLED", "TIMED_OUT"}:
            raise RunPodError(f"RunPod job {state.lower()}: {str(status.get('error') or state)[:1200]}")
    raise RunPodError(f"RunPod job timed out after {timeout_seconds} seconds (job ID {job_id}).")

if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="QUN RunPod provider tools")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("health", help="Check endpoint health without submitting a generation job")
    render_parser = sub.add_parser("generate", help="Submit one GPU generation job (may incur charges)")
    render_parser.add_argument("--prompt", required=True, help="Prompt for the reviewed workflow")
    render_parser.add_argument("--workflow", help="Path to reviewed ComfyUI API workflow JSON")
    render_parser.add_argument("--confirm-paid-render", action="store_true",
                               help="Explicitly confirm that this request may incur GPU charges")
    args = parser.parse_args()
    try:
        if args.command == "health":
            result = check_endpoint()
        else:
            if not args.confirm_paid_render:
                parser.error("generate requires --confirm-paid-render because GPU usage may incur charges")
            result = generate(args.prompt, args.workflow)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except RunPodError as exc:
        print(f"QUN provider error: {exc}", file=sys.stderr)
        raise SystemExit(1)
