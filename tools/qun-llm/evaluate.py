#!/usr/bin/env python3
"""Run the fixed QUN AI evaluation set against an OpenAI-compatible endpoint.

Defaults to local Ollama. Uses only Python standard library.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATASET = ROOT / "docs" / "qun-ai" / "evaluation-v0.1.jsonl"
BASE_URL = os.environ.get("QUN_LLM_BASE_URL", "http://127.0.0.1:11434/v1").rstrip("/")
MODEL = os.environ.get("QUN_LLM_MODEL", "qwen2.5:0.5b")
API_KEY = os.environ.get("QUN_LLM_API_KEY", "")
TIMEOUT = float(os.environ.get("QUN_LLM_TIMEOUT", "45"))


def call_model(prompt: str) -> str:
    url = BASE_URL if BASE_URL.endswith("/chat/completions") else BASE_URL + "/chat/completions"
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": (
                "Ты — QUN AI. Отвечай по-русски, честно и кратко. "
                "Не выдумывай статусы QUN, ссылки, цены и возможности. "
                "Не проси пароли, API-ключи, seed-фразы или приватные ключи. "
                "Различай работающий сервис, прототип, план и неподтверждённый статус."
            )},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0,
        "max_tokens": 700,
    }
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["Authorization"] = "Bearer " + API_KEY
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
        result = json.loads(response.read().decode("utf-8"))
    text = result["choices"][0]["message"]["content"]
    if isinstance(text, list):
        text = "".join(part.get("text", "") for part in text if isinstance(part, dict))
    return str(text).strip()


def main() -> int:
    if not DATASET.exists():
        print(f"Dataset not found: {DATASET}", file=sys.stderr)
        return 2
    cases = [json.loads(line) for line in DATASET.read_text(encoding="utf-8").splitlines() if line.strip()]
    passed = 0
    reports = []
    for case in cases:
        try:
            answer = call_model(case["input"])
            lowered = answer.casefold()
            missing = [phrase for phrase in case.get("must_include", []) if phrase.casefold() not in lowered]
            forbidden = [phrase for phrase in case.get("must_not_claim", []) if phrase.casefold() in lowered]
            ok = not missing and not forbidden
            passed += int(ok)
            reports.append({
                "id": case.get("id"),
                "pass": ok,
                "missing_required_phrases": missing,
                "forbidden_phrases_found": forbidden,
                "answer": answer,
            })
            print(f"{'PASS' if ok else 'FAIL'} {case.get('id')}")
        except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError) as exc:
            print(f"ERROR {case.get('id')}: {type(exc).__name__}: {exc}", file=sys.stderr)
            reports.append({"id": case.get("id"), "pass": False, "error": type(exc).__name__})
    report_path = Path(os.environ.get("QUN_LLM_REPORT", "qun-llm-evaluation-report.json"))
    report_path.write_text(json.dumps({
        "model": MODEL,
        "base_url": BASE_URL,
        "evaluated_at_unix": int(time.time()),
        "passed": passed,
        "total": len(cases),
        "results": reports,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Result: {passed}/{len(cases)} passed. Report: {report_path}")
    return 0 if passed == len(cases) else 1


if __name__ == "__main__":
    raise SystemExit(main())
