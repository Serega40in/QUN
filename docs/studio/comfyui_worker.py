#!/usr/bin/env python3
"""QUN Studio safe ComfyUI executor. Only runs a local, explicitly configured workflow."""
from __future__ import annotations
import json, os, sys, time, threading, uuid
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

SUPABASE_URL = os.environ.get("QUN_SUPABASE_URL", "https://qdxjltqlnphvzafapncm.supabase.co").rstrip("/")
SUPABASE_KEY = os.environ.get("QUN_SUPABASE_PUBLISHABLE_KEY", "")
NODE_ID = os.environ.get("QUN_NODE_ID", "")
NODE_TOKEN = os.environ.get("QUN_NODE_TOKEN", "")
COMFY_URL = os.environ.get("QUN_COMFYUI_URL", "http://127.0.0.1:8188").rstrip("/")
WORKFLOW_FILE = Path(os.environ.get("QUN_COMFYUI_WORKFLOW", "workflow-api.json"))
POLL_SECONDS = max(2, int(os.environ.get("QUN_POLL_SECONDS", "5")))
CLIENT_ID = str(uuid.uuid4())
STOP = threading.Event()

def api(path, body=None, timeout=25):
    if not SUPABASE_KEY:
        raise RuntimeError("Set QUN_SUPABASE_PUBLISHABLE_KEY to the Supabase publishable key.")
    data = json.dumps(body or {}).encode()
    req = Request(SUPABASE_URL + "/functions/v1/qun-compute-node",
                  data=data, method="POST",
                  headers={"Content-Type":"application/json", "apikey":SUPABASE_KEY,
                           "Authorization":"Bearer " + SUPABASE_KEY})
    # Node actions use node credentials in the body; no service-role key is used here.
    with urlopen(req, timeout=timeout) as response:
        result = json.loads(response.read().decode())
    if isinstance(result, dict) and result.get("error"):
        raise RuntimeError(result["error"])
    return result

def comfy(method, path, body=None, timeout=30):
    data = None if body is None else json.dumps(body).encode()
    req = Request(COMFY_URL + path, data=data, method=method,
                  headers={"Content-Type":"application/json"} if data else {})
    with urlopen(req, timeout=timeout) as response:
        raw = response.read()
        return json.loads(raw.decode()) if raw else {}

def heartbeat_loop(job_id):
    while not STOP.wait(35):
        try:
            api("/heartbeat", {"action":"heartbeat_job","nodeId":NODE_ID,
                               "nodeToken":NODE_TOKEN,"jobId":job_id})
        except Exception as exc:
            print("Heartbeat warning:", exc, flush=True)

def walk_replace(value, prompt, prefix):
    if isinstance(value, dict):
        return {k: walk_replace(v, prompt, prefix) for k,v in value.items()}
    if isinstance(value, list):
        return [walk_replace(v, prompt, prefix) for v in value]
    if isinstance(value, str):
        return value.replace("{{PROMPT}}", prompt).replace("{{OUTPUT_PREFIX}}", prefix)
    return value

def workflow_file_for_job(job):
    """Choose only operator-configured workflows; never accept a path from the job payload."""
    requirements = job.get("requirements") or {}
    key = str(requirements.get("workflow_key") or job.get("job_type") or "").strip().lower()
    env_names = {
        "image_generation": "QUN_COMFYUI_WORKFLOW_IMAGE",
        "image": "QUN_COMFYUI_WORKFLOW_IMAGE",
        "video_generation": "QUN_COMFYUI_WORKFLOW_VIDEO",
        "video": "QUN_COMFYUI_WORKFLOW_VIDEO",
        "audio_generation": "QUN_COMFYUI_WORKFLOW_AUDIO",
        "audio": "QUN_COMFYUI_WORKFLOW_AUDIO",
        "music": "QUN_COMFYUI_WORKFLOW_MUSIC",
        "dialogue": "QUN_COMFYUI_WORKFLOW_DIALOGUE",
        "comfyui_workflow": "QUN_COMFYUI_WORKFLOW",
    }
    env_name = env_names.get(key)
    configured = os.environ.get(env_name, "").strip() if env_name else ""
    if configured:
        return Path(configured)
    if key in ("music", "dialogue"):
        raise RuntimeError("No dedicated " + key + " workflow configured. Set " + str(env_name) + " to an operator-owned ComfyUI API workflow file.")
    # Compatibility with existing installs: other media types fall back to the original workflow.
    return WORKFLOW_FILE

def load_workflow(job):
    workflow = job.get("workflow") or {}
    if not workflow:
        selected_file = workflow_file_for_job(job)
        if not selected_file.is_file():
            raise RuntimeError("No configured ComfyUI workflow for " + str(job.get("job_type")) + ". Configure " + selected_file.name + " or the matching QUN_COMFYUI_WORKFLOW_* variable.")
        workflow = json.loads(selected_file.read_text(encoding="utf-8"))
    if not isinstance(workflow, dict) or not workflow:
        raise RuntimeError("Workflow must be a non-empty ComfyUI API-format JSON object.")
    prompt = str(job.get("prompt") or "")
    prefix = "QUN/" + str(job.get("job_id", uuid.uuid4()))
    workflow = walk_replace(workflow, prompt, prefix)
    # Optional explicit node IDs let operators target the positive-prompt fields without
    # guessing based on node class names or mutating arbitrary workflow inputs.
    node_ids = [x.strip() for x in os.environ.get("QUN_PROMPT_NODE_IDS", "").split(",") if x.strip()]
    for node_id in node_ids:
        node = workflow.get(node_id)
        if not isinstance(node, dict) or not isinstance(node.get("inputs"), dict):
            raise RuntimeError("Configured prompt node ID not found in workflow: " + node_id)
        key = os.environ.get("QUN_PROMPT_INPUT_KEY", "text")
        if key not in node["inputs"]:
            raise RuntimeError(f"Prompt input '{key}' missing in node {node_id}; use {{PROMPT}} placeholder instead.")
        node["inputs"][key] = prompt
    return workflow, prefix

def output_files(history_entry):
    found = []
    outputs = history_entry.get("outputs", {}) if isinstance(history_entry, dict) else {}
    for node_id, output in outputs.items():
        if not isinstance(output, dict): continue
        for kind in ("images", "gifs", "videos", "audio", "audio_files"):
            for item in output.get(kind, []) or []:
                if not isinstance(item, dict) or not item.get("filename"): continue
                query = urlencode({"filename":item["filename"], "subfolder":item.get("subfolder",""), "type":item.get("type","output")})
                found.append({"kind":"audio" if kind in ("audio","audio_files") else "video" if kind in ("gifs","videos") else "image",
                              "filename":item["filename"], "subfolder":item.get("subfolder",""),
                              "type":item.get("type","output"), "url":COMFY_URL+"/view?"+query})
    return found

def run_comfy(job):
    workflow, prefix = load_workflow(job)
    queued = comfy("POST", "/prompt", {"prompt":workflow,"client_id":CLIENT_ID})
    prompt_id = queued.get("prompt_id")
    if not prompt_id:
        raise RuntimeError("ComfyUI did not return prompt_id: " + json.dumps(queued)[:1200])
    deadline = time.time() + int(os.environ.get("QUN_JOB_TIMEOUT_SECONDS", "3600"))
    while time.time() < deadline:
        if STOP.is_set(): raise RuntimeError("Worker stopping")
        time.sleep(4)
        history = comfy("GET", "/history/" + prompt_id)
        entry = history.get(prompt_id)
        if not entry: continue
        status = entry.get("status", {})
        if status.get("status_str") == "error" or status.get("completed") is False and status.get("messages"):
            raise RuntimeError("ComfyUI workflow failed: " + json.dumps(status)[:1500])
        if status.get("completed") or entry.get("outputs"):
            files = output_files(entry)
            if not files: raise RuntimeError("Workflow completed but produced no discoverable image/video outputs.")
            return {"engine":"comfyui","prompt_id":prompt_id,"outputs":files,
                    "output_prefix":prefix,"note":"URLs point to the configured ComfyUI server; make it reachable by the browser to preview remotely."}
    raise TimeoutError("ComfyUI job exceeded QUN_JOB_TIMEOUT_SECONDS")

def assemble_video(job):
    """Safely concatenate generated scene files from the configured ComfyUI output directory."""
    import shutil, subprocess, tempfile
    req = job.get("requirements") or {}
    videos = req.get("video_outputs")
    if not isinstance(videos, list) or len(videos) < 2 or len(videos) > 10:
        raise RuntimeError("Assembly requires 2–10 completed video outputs.")
    root = Path(os.environ.get("QUN_COMFYUI_OUTPUT_DIR", "output")).resolve()
    ffmpeg = os.environ.get("QUN_FFMPEG_PATH", "ffmpeg")
    if not shutil.which(ffmpeg) and not Path(ffmpeg).is_file():
        raise RuntimeError("FFmpeg was not found. Install FFmpeg or set QUN_FFMPEG_PATH.")
    inputs = []
    for item in videos:
        filename = str(item.get("filename") or "")
        subfolder = str(item.get("subfolder") or "")
        if not filename or Path(filename).name != filename or Path(subfolder).is_absolute() or ".." in Path(subfolder).parts:
            raise RuntimeError("Unsafe video output reference.")
        path = (root / subfolder / filename).resolve()
        if root not in path.parents or path.suffix.lower() not in {".mp4", ".mov", ".mkv", ".webm", ".avi"} or not path.is_file():
            raise RuntimeError("Video input is missing or outside ComfyUI output: " + filename)
        inputs.append(path)
    audio = req.get("audio_output")
    audio_path = None
    if isinstance(audio, dict):
        filename = str(audio.get("filename") or "")
        subfolder = str(audio.get("subfolder") or "")
        if not filename or Path(filename).name != filename or Path(subfolder).is_absolute() or ".." in Path(subfolder).parts:
            raise RuntimeError("Unsafe audio output reference.")
        audio_path = (root / subfolder / filename).resolve()
        if root not in audio_path.parents or audio_path.suffix.lower() not in {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus"} or not audio_path.is_file():
            raise RuntimeError("Audio input is missing or outside ComfyUI output: " + filename)
    root.mkdir(parents=True, exist_ok=True)
    output = root / ("QUN_final_" + str(job.get("job_id", uuid.uuid4())) + ".mp4")
    with tempfile.TemporaryDirectory(prefix="qun-assemble-") as temp:
        concat = Path(temp) / "scenes.txt"
        concat.write_text("\n".join("file '" + str(p).replace("'", "'\\''") + "'" for p in inputs) + "\n", encoding="utf-8")
        joined = Path(temp) / "joined.mp4"
        result = subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", str(joined)], capture_output=True, text=True, timeout=900)
        if result.returncode:
            raise RuntimeError("Could not concatenate scenes; use compatible codecs. " + result.stderr[-1000:])
        if audio_path:
            result = subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(joined), "-i", str(audio_path), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-shortest", str(output)], capture_output=True, text=True, timeout=900)
            if result.returncode:
                raise RuntimeError("Could not mux soundtrack. " + result.stderr[-1000:])
        else:
            shutil.copy2(joined, output)
    if output.stat().st_size <= 0:
        raise RuntimeError("FFmpeg produced an empty MP4.")
    return {"engine":"ffmpeg", "assembled":True, "outputs":[{"kind":"video", "filename":output.name, "subfolder":"", "type":"output", "url":COMFY_URL + "/view?" + urlencode({"filename":output.name,"subfolder":"","type":"output"})}], "scene_count":len(inputs), "soundtrack_included":bool(audio_path), "bytes":output.stat().st_size, "note":"Saved to ComfyUI output; QUN Storage upload is not included yet."}

def process(job):
    job_id = job.get("job_id")
    if not job_id: raise RuntimeError("Claim response did not include job_id.")
    hb = threading.Thread(target=heartbeat_loop,args=(job_id,),daemon=True)
    STOP.clear(); hb.start()
    try:
        kind = job.get("job_type", "")
        if kind == "health_check":
            result = {"engine":"qun-compute-node","health_check":True,
                      "node_id":NODE_ID,"comfyui_reachable":False}
            try:
                comfy("GET","/system_stats",timeout=5)
                result["comfyui_reachable"] = True
            except Exception as exc:
                result["comfyui_error"] = str(exc)[:300]
            if not result["comfyui_reachable"]:
                raise RuntimeError("Node is online, but ComfyUI is not reachable: " + result.get("comfyui_error",""))
        elif kind == "comfyui_workflow" and (job.get("requirements") or {}).get("operation") == "assemble_video":
            result = assemble_video(job)
        elif kind in ("image_generation","video_generation","audio_generation","comfyui_workflow"):
            result = run_comfy(job)
        else:
            raise RuntimeError("Unsupported job type: " + str(kind))
        api("/complete", {"action":"complete_job","nodeId":NODE_ID,"nodeToken":NODE_TOKEN,
                          "jobId":job_id,"result":result})
        print(f"Job {job_id} completed: {kind}", flush=True)
    except Exception as exc:
        try:
            api("/fail", {"action":"fail_job","nodeId":NODE_ID,"nodeToken":NODE_TOKEN,
                          "jobId":job_id,"error":str(exc)[:1800]})
        except Exception as report_exc:
            print("Could not report failure:", report_exc, flush=True)
        print(f"Job {job_id} failed: {exc}", flush=True)
    finally:
        STOP.set()
        hb.join(timeout=1)

def main():
    if not NODE_ID or not NODE_TOKEN:
        print("Missing QUN_NODE_ID or QUN_NODE_TOKEN. Never put node credentials into the public website.", file=sys.stderr)
        return 2
    if len(NODE_TOKEN) != 64 or any(c not in "0123456789abcdef" for c in NODE_TOKEN):
        print("QUN_NODE_TOKEN must be the 64-character lowercase hex token stored by QUN Node.", file=sys.stderr)
        return 2
    print("QUN Studio ComfyUI worker starting. Safe mode: configured workflows only.", flush=True)
    while True:
        try:
            response = api("/claim", {"action":"claim_job","nodeId":NODE_ID,"nodeToken":NODE_TOKEN})
            job = response.get("job")
            if job:
                print("Claimed:", job.get("title","untitled"), job.get("job_type"), flush=True)
                process(job)
            else:
                time.sleep(POLL_SECONDS)
        except KeyboardInterrupt:
            print("Stopping worker.", flush=True); return 0
        except (URLError, HTTPError, TimeoutError, RuntimeError, ValueError) as exc:
            print("Queue warning:", exc, flush=True); time.sleep(max(POLL_SECONDS,10))
        except Exception as exc:
            print("Unexpected worker error:", exc, flush=True); time.sleep(max(POLL_SECONDS,10))

if __name__ == "__main__":
    raise SystemExit(main())
