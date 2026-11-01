"""QUN Studio media persistence helpers for the trusted Linux GPU worker."""
from __future__ import annotations

import hashlib
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

BUCKET = "qun-studio-media"
MAX_FILE_BYTES = 100 * 1024 * 1024

MIME_BY_SUFFIX = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".aac": "audio/aac",
    ".m4a": "audio/mp4",
}
KIND_BY_MIME = {
    "video/mp4": "video", "video/webm": "video", "video/quicktime": "video",
    "image/png": "image", "image/jpeg": "image", "image/webp": "image",
    "audio/mpeg": "audio", "audio/wav": "audio", "audio/flac": "audio",
    "audio/ogg": "audio", "audio/aac": "audio", "audio/mp4": "audio",
}


def _safe_file(output_root: Path, item: dict) -> Path:
    filename = str(item.get("filename") or "")
    subfolder = str(item.get("subfolder") or "")
    if not filename or Path(filename).name != filename:
        raise RuntimeError("Unsafe ComfyUI output filename.")
    folder = Path(subfolder)
    if folder.is_absolute() or ".." in folder.parts:
        raise RuntimeError("Unsafe ComfyUI output subfolder.")
    path = (output_root / folder / filename).resolve()
    if output_root.resolve() not in path.parents or not path.is_file():
        raise RuntimeError("ComfyUI output is missing or outside its configured output directory.")
    if path.suffix.lower() not in MIME_BY_SUFFIX:
        raise RuntimeError("Unsupported QUN media output type: " + path.suffix)
    return path


def persist_outputs(job: dict, result: dict, *, api, node_id: str, node_token: str,
                    supabase_url: str, publishable_key: str, output_dir: Path) -> dict:
    """Upload local ComfyUI outputs to the owner's private QUN Storage folder."""
    outputs = result.get("outputs") if isinstance(result, dict) else None
    if not outputs:
        return result

    stored_outputs = []
    for item in outputs:
        if not isinstance(item, dict):
            raise RuntimeError("ComfyUI returned an invalid output item.")
        local_path = _safe_file(output_dir.resolve(), item)
        size = local_path.stat().st_size
        if size <= 0 or size > MAX_FILE_BYTES:
            raise RuntimeError("Output is empty or exceeds QUN Storage's 100 MB limit.")
        content_type = MIME_BY_SUFFIX[local_path.suffix.lower()]

        signed = api("/output/upload-url", {
            "action": "create_output_upload",
            "nodeId": node_id,
            "nodeToken": node_token,
            "jobId": job["job_id"],
            "contentType": content_type,
        }).get("upload") or {}
        if signed.get("bucket") != BUCKET or not signed.get("path") or not signed.get("token"):
            raise RuntimeError("QUN Storage did not return an owner-scoped signed upload URL.")

        object_path = str(signed["path"])
        token = str(signed["token"])
        upload_url = (
            supabase_url.rstrip("/")
            + "/storage/v1/object/upload/sign/"
            + quote(BUCKET, safe="")
            + "/"
            + quote(object_path, safe="/")
            + "?token="
            + quote(token, safe="")
        )
        request = Request(
            upload_url,
            data=local_path.read_bytes(),
            method="PUT",
            headers={
                "apikey": publishable_key,
                "Authorization": "Bearer " + publishable_key,
                "Content-Type": content_type,
                "cache-control": "max-age=3600",
                "x-upsert": "false",
            },
        )
        try:
            with urlopen(request, timeout=180) as response:
                if response.status not in (200, 201):
                    raise RuntimeError("QUN Storage upload returned HTTP " + str(response.status))
                response.read()
        except HTTPError as exc:
            detail = exc.read(1200).decode("utf-8", "replace")
            raise RuntimeError("QUN Storage upload failed: HTTP " + str(exc.code) + " " + detail) from exc

        digest = hashlib.sha256(local_path.read_bytes()).hexdigest()
        registered = api("/output/register", {
            "action": "register_output_asset",
            "nodeId": node_id,
            "nodeToken": node_token,
            "jobId": job["job_id"],
            "path": object_path,
            "contentType": content_type,
            "sizeBytes": size,
            "sha256": digest,
            "filename": local_path.name,
        })
        asset = registered.get("asset") or {}
        if not asset.get("id"):
            raise RuntimeError("Uploaded file was not registered in the QUN Library.")

        saved = dict(item)
        saved.update({
            "kind": KIND_BY_MIME[content_type],
            "storage_bucket": BUCKET,
            "storage_path": object_path,
            "asset_id": asset["id"],
            "signed_url": registered.get("videoUrl"),
            "sha256": digest,
            "size_bytes": size,
            "content_type": content_type,
            "title": asset.get("title"),
        })
        saved.pop("url", None)
        stored_outputs.append(saved)

    return {
        **result,
        "outputs": stored_outputs,
        "storage": "qun-private",
        "note": "All outputs uploaded and registered in the owner's QUN Library.",
    }
