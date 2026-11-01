#!/usr/bin/env python3
"""Register a dedicated QUN ComfyUI GPU worker using a one-time owner-bound code."""
from __future__ import annotations

import getpass
import json
import os
import stat
import sys
import urllib.request
from pathlib import Path

SUPABASE_URL = os.environ.get("QUN_SUPABASE_URL", "https://qdxjltqlnphvzafapncm.supabase.co").rstrip("/")
SUPABASE_KEY = os.environ.get("QUN_SUPABASE_PUBLISHABLE_KEY", "")
REGISTRY_FILE = Path(os.environ.get(
    "QUN_NODE_REGISTRY_FILE",
    str(Path.home() / ".config" / "qun" / "render-node.json")
)).expanduser()


def request_registration(name: str, enrollment_code: str) -> dict:
    if not SUPABASE_KEY:
        raise RuntimeError("Set QUN_SUPABASE_PUBLISHABLE_KEY before registration.")
    payload = json.dumps({
        "action": "register",
        "enrollmentCode": enrollment_code.strip(),
        "name": name.strip(),
        "platform": "linux-gpu",
    }).encode("utf-8")
    req = urllib.request.Request(
        SUPABASE_URL + "/functions/v1/qun-node-registry",
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise RuntimeError("QUN registration request failed. Check network and one-time code.") from exc
    if not data.get("nodeId") or not data.get("nodeToken"):
        raise RuntimeError(data.get("error") or "QUN registry did not return node credentials.")
    return data


def save_credentials(data: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps({
        "nodeId": data["nodeId"],
        "nodeToken": data["nodeToken"],
        "registeredAt": data.get("registeredAt"),
        "platform": "linux-gpu",
    }, indent=2) + "\n", encoding="utf-8")
    try:
        os.chmod(temporary, stat.S_IRUSR | stat.S_IWUSR)
        temporary.replace(path)
        os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
    finally:
        if temporary.exists():
            temporary.unlink()


def main() -> int:
    name = input("Имя GPU-узла QUN [QUN GPU Render]: ").strip() or "QUN GPU Render"
    code = getpass.getpass("Одноразовый код подключения из QUN Studio: ").strip()
    if len(code) < 20:
        print("Код слишком короткий или пустой.", file=sys.stderr)
        return 2
    try:
        data = request_registration(name, code)
        save_credentials(data, REGISTRY_FILE)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print("GPU-узел зарегистрирован: " + data["nodeId"])
    print("Секрет сохранён в защищённом локальном файле: " + str(REGISTRY_FILE))
    print("Не публикуйте этот файл и не копируйте nodeToken в чат, GitHub или веб-страницу.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
