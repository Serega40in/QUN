"""Offline, non-billable readiness check for QUN's RunPod/ComfyUI executor.

This tool never contacts RunPod, provisions infrastructure, or starts GPU work.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


def count_placeholder(value: Any) -> int:
    if isinstance(value, dict):
        return sum(count_placeholder(v) for v in value.values())
    if isinstance(value, list):
        return sum(count_placeholder(v) for v in value)
    return 1 if value == "__QUN_PROMPT__" else 0


def inspect_workflow(path_value: str | None) -> tuple[bool, str]:
    if not path_value:
        return False, "No workflow file configured (QUN_COMFYUI_WORKFLOW)."
    path = Path(path_value).expanduser()
    if not path.is_file():
        return False, "Workflow file does not exist."
    try:
        workflow = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False, "Workflow is unreadable or invalid JSON."
    if not isinstance(workflow, dict) or not workflow:
        return False, "Workflow must be a non-empty ComfyUI API-format object."
    placeholders = count_placeholder(workflow)
    if placeholders != 1:
        return False, f"Workflow must contain exactly one __QUN_PROMPT__ placeholder (found {placeholders})."
    return True, f"Workflow JSON valid; exactly one prompt placeholder; {len(workflow)} top-level node(s)."


def build_report(env: dict[str, str] | None = None, workflow_path: str | None = None) -> dict[str, Any]:
    env = os.environ if env is None else env
    workflow_path = workflow_path or env.get("QUN_COMFYUI_WORKFLOW")
    checks: list[dict[str, str]] = []

    def add(name: str, ok: bool, detail: str) -> None:
        checks.append({"name": name, "status": "ready" if ok else "action_required", "detail": detail})

    add("provider_api_key", bool(env.get("RUNPOD_API_KEY")), 
        "API key is configured (value hidden)." if env.get("RUNPOD_API_KEY") else "Set RUNPOD_API_KEY in the trusted worker environment; never in browser code or Git.")
    add("endpoint_id", bool(env.get("RUNPOD_COMFYUI_ENDPOINT_ID")),
        "Endpoint ID is configured." if env.get("RUNPOD_COMFYUI_ENDPOINT_ID") else "Create/configure an endpoint only after reviewing costs, then set RUNPOD_COMFYUI_ENDPOINT_ID.")
    ok, detail = inspect_workflow(workflow_path)
    add("reviewed_workflow", ok, detail)
    add("durable_output", bool(env.get("QUN_OUTPUT_STORAGE_VERIFIED") == "true"),
        "Durable output has been explicitly marked verified." if env.get("QUN_OUTPUT_STORAGE_VERIFIED") == "true" else "Not verified: configure S3-compatible output and prove that results can be copied into durable QUN Storage before production.")
    return {
        "provider": "runpod-comfyui",
        "mode": "offline_preflight",
        "network_requests": 0,
        "gpu_jobs_submitted": 0,
        "resources_created": 0,
        "ready_for_health_check": bool(env.get("RUNPOD_API_KEY") and env.get("RUNPOD_COMFYUI_ENDPOINT_ID")),
        "ready_for_render": all(c["status"] == "ready" for c in checks),
        "checks": checks,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline, non-billable QUN RunPod executor preflight")
    parser.add_argument("--workflow", help="Reviewed ComfyUI API workflow JSON path")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero unless all checks pass")
    args = parser.parse_args()
    report = build_report(workflow_path=args.workflow)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if args.strict and not report["ready_for_render"] else 0


if __name__ == "__main__":
    sys.exit(main())
