# QUN Render Server — self-hosted ComfyUI GPU worker

Status: owner-bound registration, queue routing and private QUN Storage ingest are implemented in the QUN backend. A real server, ComfyUI model workflow and full GPU end-to-end render have **not yet been deployed or tested**.

## Architecture

QUN Studio / QUN Director → authenticated QUN Compute queue → one Linux GPU node owned by the same QUN ID → local ComfyUI API → FFmpeg assembly → private QUN Storage → QUN Library.

The GPU worker polls the QUN queue through outbound HTTPS. ComfyUI itself should listen only on loopback (127.0.0.1:8188). Do not expose port 8188 publicly or place a ComfyUI API key, node secret, Supabase service-role key, or provider key in GitHub Pages or browser code.

## Hardware gate — check before installing large models

First inspect the host:

```bash
nvidia-smi
lscpu
free -h
df -h
python3 --version
```

If `nvidia-smi` is missing, the VM may not have an NVIDIA GPU or the driver may not be installed. A CPU-only web hosting plan can host the public site and orchestration, but it is not a sensible place for fast high-quality video generation.

Recommended first rendering target:

- **Wan 2.2 TI2V 5B** for short text-to-video / image-to-video scenes. ComfyUI's official guide says its 5B hybrid workflow can fit around 8 GB VRAM with native offloading. That is a lower-bound experiment, not a guarantee of fast rendering.
- **Wan 2.2 14B** for more demanding video workflows. Expect substantially more memory and compute; verify the exact quantization/workflow before downloading.
- **Qwen-Image-Edit** is a 20B image-editing model. Treat it as a later, heavier image pipeline, not the first model for a small host.

Official references:
- ComfyUI manual Linux installation: https://docs.comfy.org/installation/manual_install
- Official Wan 2.2 workflow and model downloads: https://docs.comfy.org/tutorials/video/wan/wan2_2
- Official Qwen Image Edit ComfyUI workflow: https://docs.comfy.org/tutorials/image/qwen/qwen-image-edit

## Stage 1 — prepare the host

Use a Linux VM with an NVIDIA GPU and enough disk space for model weights, temporary video files, and ComfyUI output. Keep the OS and GPU driver current. Do not start a paid machine or attach billing unless the owner explicitly approves it.

Install basic packages (Ubuntu/Debian example):

```bash
sudo apt update
sudo apt install -y git python3 python3-venv python3-pip ffmpeg
```

Create separate working folders and Python environments:

```bash
mkdir -p ~/qun-render ~/models
cd ~/qun-render
git clone https://github.com/Comfy-Org/ComfyUI.git
python3 -m venv .venv
source .venv/bin/activate
```

Install a PyTorch build matching the exact NVIDIA driver/CUDA environment, then:

```bash
cd ~/qun-render/ComfyUI
pip install -r requirements.txt
```

For the first test, use the official Wan 2.2 5B workflow template in ComfyUI's Workflow → Browse Templates → Video. Download only the model files listed by that exact template and put them in the model folders specified in the official guide. Do not install random custom nodes or workflows from untrusted sources.

## Stage 2 — keep ComfyUI private

Start ComfyUI on localhost only:

```bash
cd ~/qun-render/ComfyUI
source ../.venv/bin/activate
python main.py --listen 127.0.0.1 --port 8188
```

Confirm locally:

```bash
curl -fsS http://127.0.0.1:8188/system_stats
```

Do not open TCP 8188 in the public firewall. The QUN worker and ComfyUI are on the same host; only the worker needs internet access to reach QUN's HTTPS API.

## Stage 3 — prepare an API workflow

1. Load the official Wan2.2 5B template in ComfyUI.
2. Check it works manually with a small test, after verifying the model is actually installed.
3. Export **Workflow → Export (API)**.
4. In the API JSON, replace only the intended positive-prompt text with the exact placeholder `{{PROMPT}}`.
5. Copy the API workflow to `~/qun-render/workflow-video-api.json`.
6. Use the same approach for a separate image workflow if needed. Video and image workflows should be separate.

The QUN worker runs only the configured operator-owned workflow. It does not accept workflow JSON or arbitrary node paths from public users.

## Stage 4 — register this GPU machine to a QUN ID

1. Open https://quniverse.ru/studio/render-node.html and sign in with the QUN ID that should own the generated media.
2. Click **Создать код подключения**. The code expires after 15 minutes and can be used once.
3. On the Linux host, in a terminal, run:

```bash
git clone --depth 1 https://github.com/Serega40in/QUN.git ~/qun-repo
cd ~/qun-repo/docs/studio
export QUN_SUPABASE_PUBLISHABLE_KEY="sb_publishable_aCUwbGYj_kUU8nVUu1kWmQ_-d-8fp8L"
python3 register_gpu_worker.py
```

The registration script asks for the code without echoing it, registers the host as `linux-gpu`, and stores the individual node token in `~/.config/qun/render-node.json` with owner-only file permissions. Do not copy that file to GitHub, screenshots, chat, or another machine.

## Stage 5 — configure the worker

```bash
export QUN_SUPABASE_PUBLISHABLE_KEY="sb_publishable_aCUwbGYj_kUU8nVUu1kWmQ_-d-8fp8L"
export QUN_COMFYUI_URL="http://127.0.0.1:8188"
export QUN_COMFYUI_OUTPUT_DIR="$HOME/qun-render/ComfyUI/output"
export QUN_COMFYUI_WORKFLOW_VIDEO="$HOME/qun-render/workflow-video-api.json"
export QUN_FFMPEG_PATH="/usr/bin/ffmpeg"
export QUN_NODE_REGISTRY_FILE="$HOME/.config/qun/render-node.json"

python3 "$HOME/qun-repo/docs/studio/comfyui_worker.py"
```

Optional image workflow:

```bash
export QUN_COMFYUI_WORKFLOW_IMAGE="$HOME/qun-render/workflow-image-api.json"
```

The worker sends heartbeat messages, claims jobs only for the QUN ID that owns the node, executes configured workflows, uploads generated media to that owner's private QUN Storage folder, registers the Library asset, and then marks the job complete.

## Security and cost boundaries

- No paid provider or GPU resource is started by this guide.
- No paid fallback is configured.
- Do not place Supabase service-role keys, GigaChat credentials, or node tokens on the website or in the repository.
- ComfyUI is private on loopback; the QUN worker uses outbound TLS.
- The GPU node receives only that owner's media jobs. Other QUN nodes continue to receive their existing health-check scope.
- File uploads are limited to 100 MB each by the current QUN bucket.
- This is an initial single-owner GPU worker, not a public multi-tenant GPU marketplace.

## Acceptance test still required

- ComfyUI `/system_stats` responds locally.
- QUN Render Node appears online for the correct QUN ID.
- One explicitly submitted short generation job is claimed by that node.
- The output is uploaded to private QUN Storage and visible in the owner's QUN Library.
- A generated scene and a selected library soundtrack are assembled into an MP4 and saved as another Library asset.
- Worker restart, generation failure, and expired signed URL do not mark failed jobs as successful.
