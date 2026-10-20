#!/usr/bin/env python3
"""QUN Node Worker 0.1 — opt-in, allow-listed ComfyUI queue worker.

This agent does not execute shell commands or arbitrary workflows from the server.
It runs in safe dry-run mode until explicitly configured with a locally reviewed
ComfyUI workflow template.
"""
from __future__ import annotations
import hashlib, json, os, platform, secrets, sys, time, urllib.error, urllib.request
from pathlib import Path

BASE = os.environ.get("QUN_SUPABASE_URL", "https://qdxjltqlnphvzafapncm.supabase.co").rstrip("/")
PUBLIC_KEY = os.environ.get("QUN_SUPABASE_PUBLISHABLE_KEY", "")
NODE_ID_FILE = Path(os.environ.get("QUN_NODE_CREDENTIALS", str(Path.home() / ".qun-node" / "credentials.json")))
POLL_SECONDS = max(10, int(os.environ.get("QUN_POLL_SECONDS", "20")))
COMFY_URL = os.environ.get("QUN_COMFY_URL", "http://127.0.0.1:8188").rstrip("/")
# Only local, reviewed workflows may be added to this map.
WORKFLOW_ALLOWLIST: dict[str, Path] = {}

def request_json(url: str, payload: dict, headers: dict | None = None) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type":"application/json", **(headers or {})}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            raw = response.read(2_000_001)
            if len(raw) > 2_000_000:
                raise RuntimeError("Server response too large")
            return json.loads(raw or b"{}")
    except urllib.error.HTTPError as exc:
        detail = exc.read(2000).decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc

def api(body: dict) -> dict:
    return request_json(BASE + "/functions/v1/qun-compute-node", body, {
        "apikey": PUBLIC_KEY, "Authorization": "Bearer " + PUBLIC_KEY
    })

def node_call(action: str, creds: dict, **kwargs) -> dict:
    return api({"action": action, "nodeId": creds["nodeId"], "nodeToken": creds["nodeToken"], **kwargs})

def load_credentials() -> dict | None:
    if not NODE_ID_FILE.exists():
        return None
    try:
        data = json.loads(NODE_ID_FILE.read_text(encoding="utf-8"))
        if isinstance(data.get("nodeId"), str) and isinstance(data.get("nodeToken"), str):
            return data
    except (OSError, ValueError):
        pass
    return None

def register() -> dict:
    code = os.environ.get("QUN_ENROLLMENT_CODE", "").strip()
    if len(code) < 20:
        raise RuntimeError("Set QUN_ENROLLMENT_CODE to a one-time code created in the QUN Node admin flow.")
    name = os.environ.get("QUN_NODE_NAME", platform.node()[:80] or "QUN Worker")
    result = request_json(BASE + "/functions/v1/qun-node-registry", {
        "action":"register", "enrollmentCode":code, "name":name,
        "platform":f"{platform.system()} {platform.machine()}"[:40]
    }, {"apikey":PUBLIC_KEY, "Authorization":"Bearer "+PUBLIC_KEY})
    if not result.get("nodeId") or not result.get("nodeToken"):
        raise RuntimeError("Node registration returned no credentials")
    NODE_ID_FILE.parent.mkdir(parents=True, exist_ok=True)
    NODE_ID_FILE.write_text(json.dumps(result, indent=2), encoding="utf-8")
    try: NODE_ID_FILE.chmod(0o600)
    except OSError: pass
    print(f"Registered node {result['nodeId']}. Credentials saved to {NODE_ID_FILE}. Keep this file private.")
    return result

def run_job(job: dict) -> dict:
    """Handle lightweight health checks; only run reviewed local workflows."""
    job_type = job.get("job_type") or job.get("type")
    if job_type == "health_check":
        return {
            "provider": "qun-worker",
            "health_check": True,
            "node": platform.node()[:120],
            "platform": platform.platform()[:160],
            "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "comfyui_configured": bool(WORKFLOW_ALLOWLIST),
        }
    requirements = job.get("requirements") or {}
    workflow_id = requirements.get("workflow_id")
    if not isinstance(workflow_id, str) or workflow_id not in WORKFLOW_ALLOWLIST:
        raise RuntimeError("No locally allow-listed workflow configured; job safely refused")
    workflow_path = WORKFLOW_ALLOWLIST[workflow_id]
    if not workflow_path.is_file():
        raise RuntimeError(f"Local workflow template not found: {workflow_id}")
    workflow = json.loads(workflow_path.read_text(encoding="utf-8"))
    # User prompt is never interpreted as code or shell syntax.
    prompt = job.get("prompt", "")
    if prompt:
        # Templates may opt into this single placeholder in known text fields.
        workflow = json.loads(json.dumps(workflow).replace("__QUN_PROMPT__", json.dumps(prompt)[1:-1]))
    body = json.dumps({"prompt":workflow}).encode()
    req = urllib.request.Request(COMFY_URL + "/prompt", data=body, headers={"Content-Type":"application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as response:
        accepted = json.loads(response.read(100_000))
    prompt_id = accepted.get("prompt_id")
    if not prompt_id:
        raise RuntimeError("ComfyUI did not return a prompt_id")
    # Poll history until complete. Worker restarts are safe; a stuck job can be retried by an operator.
    deadline = time.time() + int(os.environ.get("QUN_JOB_TIMEOUT_SECONDS", "1800"))
    while time.time() < deadline:
        time.sleep(3)
        with urllib.request.urlopen(COMFY_URL + "/history/" + str(prompt_id), timeout=20) as response:
            history = json.loads(response.read(500_000))
        item = history.get(prompt_id)
        if item and item.get("status", {}).get("completed"):
            return {"provider":"comfyui", "prompt_id":prompt_id, "history":item}
    raise RuntimeError("ComfyUI job timed out")

def main() -> int:
    if not PUBLIC_KEY:
        print("Missing QUN_SUPABASE_PUBLISHABLE_KEY environment variable.", file=sys.stderr); return 2
    creds = load_credentials()
    if not creds:
        if "--register" not in sys.argv:
            print(f"No node credentials found at {NODE_ID_FILE}. Set QUN_ENROLLMENT_CODE and run with --register.")
            return 2
        creds = register()
    print(f"QUN Node Worker 0.1 online as {creds['nodeId']}. Safe mode: no arbitrary remote workflows.")
    while True:
        try:
            node_call("node_heartbeat", creds)
            result = node_call("claim_job", creds)
            job = result.get("job")
            if not job:
                time.sleep(POLL_SECONDS); continue
            print(f"Claimed job {job.get('job_id')} ({job.get('job_type')})")
            try:
                output = run_job(job)
                node_call("complete_job", creds, jobId=job["job_id"], result=output)
                print(f"Completed job {job['job_id']}")
            except Exception as exc:
                message = str(exc)[:1500]
                node_call("fail_job", creds, jobId=job["job_id"], error=message)
                print(f"Job failed safely: {message}", file=sys.stderr)
        except KeyboardInterrupt:
            print("Worker stopped by operator."); return 0
        except Exception as exc:
            print(f"Worker/API error: {exc}", file=sys.stderr)
            time.sleep(POLL_SECONDS)

if __name__ == "__main__":
    raise SystemExit(main())
