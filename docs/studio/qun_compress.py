"""Size-cap final MP4s before uploading them to QUN Storage."""
from pathlib import Path
import os
import shutil
import subprocess

LIMIT = 98 * 1024 * 1024


def cap_output_size(output_path: Path, ffmpeg_path: str, has_audio: bool) -> Path:
    output_path = Path(output_path)
    if output_path.stat().st_size <= LIMIT:
        return output_path
    ffprobe = shutil.which(os.environ.get("QUN_FFPROBE_PATH", "ffprobe"))
    if not ffprobe:
        raise RuntimeError("Final MP4 exceeds 98 MiB and ffprobe is unavailable for size-safe compression.")
    probe = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(output_path)],
        capture_output=True, text=True, timeout=30
    )
    if probe.returncode:
        raise RuntimeError("Could not measure final MP4 duration for compression.")
    duration = float(probe.stdout.strip() or 0)
    if duration <= 0:
        raise RuntimeError("Final MP4 duration is invalid.")
    audio_bps = 128000 if has_audio else 0
    target_bps = int((LIMIT * 8 / duration) * 0.88) - audio_bps
    if target_bps < 300000:
        raise RuntimeError("The soundtrack is too long to fit the QUN Storage size limit at a safe bitrate.")

    compressed = output_path.with_name(output_path.stem + "_compressed.mp4")
    last_size = 0
    for attempt in range(2):
        bitrate = int(target_bps * (0.82 ** attempt))
        command = [
            ffmpeg_path, "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(output_path),
            "-c:v", "libx264", "-preset", "veryfast",
            "-b:v", str(bitrate), "-maxrate", str(bitrate),
            "-bufsize", str(bitrate * 2), "-pix_fmt", "yuv420p"
        ]
        command += ["-c:a", "aac", "-b:a", "128k"] if has_audio else ["-an"]
        command += ["-movflags", "+faststart", str(compressed)]
        result = subprocess.run(command, capture_output=True, text=True, timeout=1800)
        if result.returncode or not compressed.is_file():
            raise RuntimeError("Size-safe MP4 compression failed: " + result.stderr[-1200:])
        last_size = compressed.stat().st_size
        if last_size <= LIMIT:
            os.replace(compressed, output_path)
            return output_path

    try:
        compressed.unlink()
    except FileNotFoundError:
        pass
    raise RuntimeError("Compressed MP4 still exceeds 98 MiB (" + str(round(last_size / 1024 / 1024, 1)) + " MiB).")
