from __future__ import annotations

import argparse
import base64
import json
import os
import re
import threading
import time
import uuid
import webbrowser
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE = Path(__file__).resolve().parent
ROOT = BASE / "output"
LIBRARY = ROOT / "imported"
EXPORTS = ROOT / "export"
for folder in (LIBRARY, EXPORTS):
    folder.mkdir(parents=True, exist_ok=True)

HOST = "127.0.0.1"
PORT = int(os.environ.get("QUN_STICKER_PORT", "8791"))
COMFY = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188").rstrip("/")
MAX_REQUEST = 24 * 1024 * 1024
JOBS: list[dict] = []


def safe_name(value: str) -> str:
    name = Path(str(value)).name
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return name[:100] or "sticker.png"


def api_json(url: str, payload: dict | None = None, timeout: int = 10) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
    return json.loads(raw.decode("utf-8")) if raw else {}


def backend_status() -> dict:
    try:
        stats = api_json(COMFY + "/system_stats", timeout=3)
        info = api_json(COMFY + "/object_info/CheckpointLoaderSimple", timeout=3)
        req = info.get("CheckpointLoaderSimple", {}).get("input", {}).get("required", {})
        models = req.get("ckpt_name", [[]])[0]
        return {"connected": True, "url": COMFY, "models": models if isinstance(models, list) else [], "devices": stats.get("devices", [])}
    except Exception as exc:
        return {"connected": False, "url": COMFY, "models": [], "error": str(exc)[:200]}


class Handler(BaseHTTPRequestHandler):
    server_version = "QUNStickerStudio/0.1"

    def log_message(self, fmt, *args):
        print("[QUN Sticker Studio] " + (fmt % args))

    def send_data(self, data: bytes, mime: str, status: int = 200, download: str | None = None):
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if download:
            self.send_header("Content-Disposition", 'attachment; filename="' + safe_name(download) + '"')
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, data: dict, status: int = 200):
        self.send_data(json.dumps(data, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8", status)

    def body_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length < 0 or length > MAX_REQUEST:
            raise ValueError("Request too large")
        raw = self.rfile.read(length)
        value = json.loads(raw.decode("utf-8")) if raw else {}
        if not isinstance(value, dict):
            raise ValueError("Expected a JSON object")
        return value

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        path = parsed.path

        if path in ("/", "/index.html"):
            return self.send_data((BASE / "index.html").read_bytes(), "text/html; charset=utf-8")
        if path == "/api/status":
            return self.send_json({"studio": "ready", "version": "0.1", "comfyui": backend_status()})
        if path == "/api/files":
            files = []
            for item in sorted(LIBRARY.iterdir(), key=lambda p: p.name.lower()):
                if item.is_file() and item.suffix.lower() in (".png", ".webp"):
                    files.append({"name": item.name, "bytes": item.stat().st_size, "url": "/api/file?name=" + urllib.parse.quote(item.name)})
            return self.send_json({"files": files})
        if path == "/api/file":
            name = safe_name((query.get("name") or [""])[0])
            target = LIBRARY / name
            if not target.is_file():
                return self.send_json({"error": "File not found"}, 404)
            mime = "image/webp" if target.suffix.lower() == ".webp" else "image/png"
            return self.send_data(target.read_bytes(), mime)
        if path == "/api/download":
            name = safe_name((query.get("name") or [""])[0])
            target = EXPORTS / name
            if not target.is_file() or target.suffix.lower() != ".zip":
                return self.send_json({"error": "Archive not found"}, 404)
            return self.send_data(target.read_bytes(), "application/zip", download=name)
        if path == "/api/comfy-image":
            filename = (query.get("filename") or [""])[0]
            subfolder = (query.get("subfolder") or [""])[0]
            kind = (query.get("type") or ["output"])[0]
            if not filename or ".." in filename or ".." in subfolder or kind not in ("output", "temp"):
                return self.send_json({"error": "Invalid image path"}, 400)
            url = COMFY + "/view?" + urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": kind})
            try:
                with urllib.request.urlopen(url, timeout=12) as response:
                    return self.send_data(response.read(), response.headers.get("Content-Type", "image/png"))
            except Exception as exc:
                return self.send_json({"error": str(exc)[:200]}, 502)
        if path == "/api/jobs":
            output = []
            for job in JOBS[-30:]:
                item = dict(job)
                try:
                    history = api_json(COMFY + "/history/" + urllib.parse.quote(job["prompt_id"]), timeout=3)
                    record = history.get(job["prompt_id"], {})
                    images = []
                    for node in record.get("outputs", {}).values():
                        for img in node.get("images", []):
                            images.append({"filename": img.get("filename", ""), "subfolder": img.get("subfolder", ""), "type": img.get("type", "output")})
                    if images:
                        item["status"] = "completed"
                        item["images"] = images
                    elif record:
                        item["status"] = "finished"
                except Exception:
                    pass
                output.append(item)
            return self.send_json({"jobs": output})
        return self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        try:
            payload = self.body_json()
            if path == "/api/import":
                return self.import_image(payload)
            if path == "/api/generate":
                return self.generate(payload)
            if path == "/api/export":
                return self.export_pack(payload)
            return self.send_json({"error": "Not found"}, 404)
        except (ValueError, json.JSONDecodeError) as exc:
            return self.send_json({"error": str(exc)}, 400)
        except Exception as exc:
            return self.send_json({"error": str(exc)[:300]}, 500)

    def import_image(self, payload: dict):
        filename = safe_name(payload.get("filename", "sticker.png"))
        if not filename.lower().endswith((".png", ".webp")):
            return self.send_json({"error": "Only PNG and WebP are accepted"}, 400)
        data_url = str(payload.get("data_url", ""))
        if "," not in data_url or len(data_url) > MAX_REQUEST:
            return self.send_json({"error": "Invalid or oversized image payload"}, 400)
        _, encoded = data_url.split(",", 1)
        raw = base64.b64decode(encoded, validate=True)
        png = raw.startswith(b"\x89PNG\r\n\x1a\n")
        webp = raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"
        if not (png or webp):
            return self.send_json({"error": "Image data is not PNG or WebP"}, 400)
        if filename.lower().endswith(".png") != png:
            return self.send_json({"error": "File extension does not match image data"}, 400)
        if not raw or len(raw) > 16 * 1024 * 1024:
            return self.send_json({"error": "Image must be under 16 MB"}, 400)
        stored = str(int(time.time())) + "_" + uuid.uuid4().hex[:8] + "_" + filename
        (LIBRARY / stored).write_bytes(raw)
        return self.send_json({"saved": stored, "bytes": len(raw)})

    def generate(self, payload: dict):
        status = backend_status()
        if not status["connected"]:
            return self.send_json({"error": "ComfyUI is not connected at " + COMFY}, 503)
        model = str(payload.get("model", "")).strip()
        prompt = str(payload.get("prompt", "")).strip()
        negative = str(payload.get("negative", "")).strip()
        count = max(1, min(8, int(payload.get("count", 1))))
        if not prompt or len(prompt) > 6000:
            return self.send_json({"error": "Prompt must contain 1–6000 characters"}, 400)
        if model not in status["models"]:
            return self.send_json({"error": "Select a checkpoint installed in ComfyUI"}, 400)
        queued = []
        for i in range(count):
            workflow = {
                "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": model}},
                "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["1", 1]}},
                "3": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["1", 1]}},
                "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 512, "height": 512, "batch_size": 1}},
                "5": {"class_type": "KSampler", "inputs": {"seed": (time.time_ns() + i) % 2147483647, "steps": 22, "cfg": 6.5, "sampler_name": "euler", "scheduler": "normal", "denoise": 1.0, "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0]}},
                "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
                "7": {"class_type": "SaveImage", "inputs": {"filename_prefix": "QUN_Sticker_Studio/candidate", "images": ["6", 0]}},
            }
            response = api_json(COMFY + "/prompt", {"prompt": workflow, "client_id": str(uuid.uuid4())}, timeout=20)
            prompt_id = response.get("prompt_id")
            if not prompt_id:
                raise RuntimeError("ComfyUI did not return a prompt ID")
            job = {"prompt_id": prompt_id, "model": model, "prompt": prompt[:150], "created_at": datetime.now(timezone.utc).isoformat(), "status": "queued"}
            JOBS.append(job)
            queued.append(job)
        return self.send_json({"queued": queued})

    def export_pack(self, payload: dict):
        title = str(payload.get("title", "")).strip()[:80]
        slug = re.sub(r"[^a-z0-9_-]+", "_", str(payload.get("short_name", "qun_pack")).lower()).strip("_-")[:40]
        artist = str(payload.get("artist", "")).strip()[:80]
        license_note = str(payload.get("license", "")).strip()[:400]
        selected = payload.get("files", [])
        if not title or not slug or not artist or not isinstance(selected, list) or not selected:
            return self.send_json({"error": "Title, pack ID, author and at least one sticker are required"}, 400)
        manifest = {"schema_version": "1.0", "platform": "QUN", "pack": {"id": slug, "title": title, "artist": artist, "license": license_note, "created_at": datetime.now(timezone.utc).isoformat()}, "stickers": []}
        archive_path = EXPORTS / (slug + ".zip")
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for i, entry in enumerate(selected[:200], 1):
                name = safe_name(entry.get("name", ""))
                source = LIBRARY / name
                if not source.is_file() or source.suffix.lower() not in (".png", ".webp"):
                    continue
                emoji = str(entry.get("emoji", "🙂"))[:16]
                inside = "stickers/" + str(i).zfill(2) + "-" + name
                archive.write(source, inside)
                manifest["stickers"].append({"id": i, "file": inside, "emoji": emoji})
            if not manifest["stickers"]:
                return self.send_json({"error": "No valid selected files"}, 400)
            archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
            archive.writestr("SUBMISSION.txt", "QUN sticker pack submission draft. Human review and rights approval are required. This package has not been published.\n")
        return self.send_json({"download": "/api/download?name=" + urllib.parse.quote(archive_path.name), "name": archive_path.name, "count": len(manifest["stickers"])})


def main():
    parser = argparse.ArgumentParser(description="QUN Sticker Studio local server")
    parser.add_argument("--open", action="store_true", help="Open the browser")
    args = parser.parse_args()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    url = "http://" + HOST + ":" + str(PORT) + "/"
    print("\nQUN Sticker Studio 0.1")
    print("Browser: " + url)
    print("ComfyUI: " + COMFY)
    print("Keep this window open. Press Ctrl+C to stop.\n")
    if args.open:
        threading.Timer(1, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        print("\nStopping QUN Sticker Studio.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
