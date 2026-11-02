"""FFmpeg assembly for trusted QUN GPU workers."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from qun_compress import cap_output_size

ALLOWED_HOST = "qdxjltqlnphvzafapncm.supabase.co"
BUCKET_PREFIX = "/storage/v1/object/sign/qun-studio-media/"
MAX_ASSET_BYTES = 45 * 1024 * 1024
VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".webm", ".avi"}
AUDIO_EXTS = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".webm"}


def _download_signed(item: dict, folder: Path, name: str, publishable_key: str) -> Path:
    url = str(item.get("signed_url") or item.get("url") or "")
    parsed = urlparse(url)
    if (parsed.scheme != "https" or parsed.hostname != ALLOWED_HOST
            or not parsed.path.startswith(BUCKET_PREFIX)):
        raise RuntimeError("Only signed URLs from the private QUN Studio bucket can be used for assembly.")
    suffix = Path(parsed.path).suffix.lower()
    if suffix not in VIDEO_EXTS | AUDIO_EXTS:
        raise RuntimeError("Unsupported QUN Storage media extension: " + suffix)
    target = folder / (name + suffix)
    request = Request(url, headers={
        "apikey": publishable_key,
        "Authorization": "Bearer " + publishable_key,
    })
    total = 0
    try:
        with urlopen(request, timeout=90) as response, target.open("wb") as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_ASSET_BYTES:
                    raise RuntimeError("A QUN source asset exceeds the 45 MiB safe file limit.")
                output.write(chunk)
    except HTTPError as exc:
        raise RuntimeError("Could not download a signed QUN Storage asset: HTTP " + str(exc.code)) from exc
    if total <= 0:
        raise RuntimeError("QUN Storage returned an empty source asset.")
    return target


def _local_output(item: dict, root: Path, allow: set[str]) -> Path:
    filename = str(item.get("filename") or "")
    subfolder = str(item.get("subfolder") or "")
    folder = Path(subfolder)
    if (not filename or Path(filename).name != filename
            or folder.is_absolute() or ".." in folder.parts):
        raise RuntimeError("Unsafe local ComfyUI output reference.")
    path = (root / folder / filename).resolve()
    if root not in path.parents or path.suffix.lower() not in allow or not path.is_file():
        raise RuntimeError("Local ComfyUI media input is missing or outside its output folder.")
    if path.stat().st_size > MAX_ASSET_BYTES:
        raise RuntimeError("A local ComfyUI media input exceeds the 100 MB file limit.")
    return path


def _resolve(item: dict, root: Path, temp: Path, index: int, allow: set[str], key: str) -> Path:
    if not isinstance(item, dict):
        raise RuntimeError("Invalid media reference in assembly job.")
    if item.get("signed_url") or (item.get("storage_bucket") == "qun-studio-media" and item.get("url")):
        return _download_signed(item, temp, "asset_" + str(index), key)
    return _local_output(item, root, allow)


def assemble_film(job: dict, *, output_dir: Path, ffmpeg_path: str, publishable_key: str) -> dict:
    requirements = job.get("requirements") or {}
    videos = requirements.get("video_outputs")
    if not isinstance(videos, list) or len(videos) < 1 or len(videos) > 12:
        raise RuntimeError("Assembly requires 1–12 selected/generated video scenes.")
    if not shutil.which(ffmpeg_path) and not Path(ffmpeg_path).is_file():
        raise RuntimeError("FFmpeg was not found. Install FFmpeg or set QUN_FFMPEG_PATH.")

    root = output_dir.resolve()
    root.mkdir(parents=True, exist_ok=True)
    output = root / ("QUN_final_" + str(job.get("job_id") or uuid.uuid4()) + ".mp4")
    audio = requirements.get("audio_output")

    with tempfile.TemporaryDirectory(prefix="qun-assembly-") as temp_name:
        temp = Path(temp_name)
        inputs = [
            _resolve(item, root, temp, index, VIDEO_EXTS, publishable_key)
            for index, item in enumerate(videos, start=1)
        ]
        audio_path = None
        if isinstance(audio, dict):
            audio_path = _resolve(audio, root, temp, 99, AUDIO_EXTS, publishable_key)

        command = [ffmpeg_path, "-hide_banner", "-loglevel", "error", "-y"]
        for path in inputs:
            command += ["-i", str(path)]

        filters = []
        labels = []
        for index in range(len(inputs)):
            label = "v" + str(index)
            filters.append(
                "[" + str(index) + ":v]"
                "scale=1280:720:force_original_aspect_ratio=decrease,"
                "pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,"
                "setsar=1,fps=24,format=yuv420p[" + label + "]"
            )
            labels.append("[" + label + "]")
        filters.append("".join(labels) + "concat=n=" + str(len(inputs)) + ":v=1:a=0[vout]")
        montage = temp / "montage.mp4"
        command += [
            "-filter_complex", ";".join(filters), "-map", "[vout]",
            "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(montage),
        ]
        result = subprocess.run(command, capture_output=True, text=True, timeout=1800)
        if result.returncode:
            raise RuntimeError("FFmpeg scene normalization failed: " + result.stderr[-1800:])

        if audio_path:
            repeat = bool(requirements.get("repeat_video_to_audio", True))
            music_duration = requirements.get("music_duration_seconds")
            if music_duration is not None:
                try:
                    music_duration = float(music_duration)
                except (TypeError, ValueError):
                    raise RuntimeError("Music duration must be a number of seconds.")
                if music_duration < 1 or music_duration > 600:
                    raise RuntimeError("Music duration must be between 1 and 600 seconds.")
            mux = [ffmpeg_path, "-hide_banner", "-loglevel", "error", "-y"]
            if repeat:
                mux += ["-stream_loop", "-1"]
            mux += ["-i", str(montage), "-i", str(audio_path),
                    "-map", "0:v:0", "-map", "1:a:0",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
                    "-shortest"]
            if music_duration is not None:
                mux += ["-t", f"{music_duration:.3f}"]
            mux += ["-movflags", "+faststart", str(output)]
            result = subprocess.run(mux, capture_output=True, text=True, timeout=3600)
            if result.returncode:
                raise RuntimeError("FFmpeg soundtrack mux failed: " + result.stderr[-1800:])
        else:
            shutil.copy2(montage, output)

    if not output.is_file() or output.stat().st_size <= 0:
        raise RuntimeError("FFmpeg did not create a valid MP4.")
    cap_output_size(output, ffmpeg_path, bool(audio_path))
    return {
        "engine": "ffmpeg",
        "assembled": True,
        "outputs": [{
            "kind": "video",
            "filename": output.name,
            "subfolder": "",
            "type": "output",
        }],
        "scene_count": len(videos),
        "soundtrack_included": bool(audio_path),
        "bytes": output.stat().st_size,
    }
