# QUN Studio — ComfyUI GPU worker

This is the next execution layer for the existing QUN Compute queue. It runs on a machine you control and connects to a local or privately hosted ComfyUI server. It does not require installing large models on the QUN website host.

## Important status

- The queue API is the existing Supabase Edge Function \`qun-compute-node\` (node-authenticated endpoint). The user-facing job API is \`qun-compute\`.
- This worker uses the existing node credential pair (\`QUN_NODE_ID\`, \`QUN_NODE_TOKEN\`) and never uses a Supabase service-role key.
- ComfyUI must be installed and running separately, with a workflow exported in **API format**.
- To use a remote ComfyUI instance, set \`QUN_COMFYUI_URL\` to an endpoint reachable from the worker. For previews to load in a browser, that endpoint must also be reachable by the browser; do not expose ComfyUI publicly without authentication/network restrictions.
- This does not promise free or unlimited GPU compute. It allows repeated jobs while your node/GPU and any provider quota are available.
- Safe mode: the worker runs only the configured ComfyUI workflow. Do not accept workflows from untrusted users on a shared worker.

## Quick start (Windows PowerShell)

1. Install Python 3.10+.
2. Start ComfyUI and confirm \`http://127.0.0.1:8188/system_stats\` opens on the same machine.
3. In ComfyUI, load your chosen image/video workflow and use **Save (API Format)**. Save the result as \`workflow-api.json\` next to \`comfyui_worker.py\`. For a workflow's positive prompt text, replace its text value with \`{{PROMPT}}\`; optionally set the output prefix to \`{{OUTPUT_PREFIX}}\`.
4. Open PowerShell and set the variables below. Get node credentials from the local QUN Node configuration; never paste them into GitHub, a screenshot, or a public issue.

\`\`\`powershell
$env:QUN_SUPABASE_URL = "https://qdxjltqlnphvzafapncm.supabase.co"
$env:QUN_SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY"
$env:QUN_NODE_ID = "YOUR_REGISTERED_NODE_UUID"
$env:QUN_NODE_TOKEN = "YOUR_64_CHARACTER_NODE_TOKEN"
$env:QUN_COMFYUI_URL = "http://127.0.0.1:8188"
$env:QUN_COMFYUI_WORKFLOW = ".\\workflow-api.json"
python .\comfyui_worker.py
\`\`\`

The publishable key is public by design, but the node token is a secret. Never use a Supabase service-role/secret key in this worker.

## Separate media workflows (image / video / music / dialogue)

One node can serve different kinds of jobs using separate **operator-owned** ComfyUI API workflow JSON files. This avoids forcing audio tasks through a video graph. Export each graph with **Save (API Format)** and put `{{PROMPT}}` in the relevant prompt text field.

Configure only the workflows you actually have installed:

```powershell
$env:QUN_COMFYUI_WORKFLOW_IMAGE = ".\\workflow-image-api.json"
$env:QUN_COMFYUI_WORKFLOW_VIDEO = ".\\workflow-video-api.json"
$env:QUN_COMFYUI_WORKFLOW_MUSIC = ".\\workflow-music-api.json"
$env:QUN_COMFYUI_WORKFLOW_DIALOGUE = ".\\workflow-dialogue-api.json"
python .\\comfyui_worker.py
```

Routing rules:
- `image_generation` uses `QUN_COMFYUI_WORKFLOW_IMAGE`
- `video_generation` uses `QUN_COMFYUI_WORKFLOW_VIDEO`
- `audio_generation` uses `QUN_COMFYUI_WORKFLOW_AUDIO` by default, or `requirements.workflow_key = "music"` / `"dialogue"` to select the matching specific workflow
- missing per-type settings fall back to the existing `QUN_COMFYUI_WORKFLOW` for backward compatibility

The worker still runs only workflows you configured. It does not download models, install custom nodes, or expose your ComfyUI server. Audio outputs are detected when the ComfyUI history reports `audio` or `audio_files` entries. QUN Director now supports an optional FFmpeg assembly job: it concatenates completed scene clips and can mux a completed soundtrack. The worker must have FFmpeg installed and must be configured with the real ComfyUI output directory. The assembled MP4 is written locally; uploading it to QUN Storage remains a separate step.

## Prompt mapping

The simplest and recommended mapping is to put \`{{PROMPT}}\` inside the positive prompt's text field in the exported API workflow. The worker replaces this exact placeholder before submitting the workflow.

If you prefer node-ID mapping, set both variables:
\`\`\`powershell
$env:QUN_PROMPT_NODE_IDS = "6"
$env:QUN_PROMPT_INPUT_KEY = "text"
\`\`\`
Replace \`6\` with the actual positive-prompt node ID. This mapping is optional.

## How to test

1. Start ComfyUI, then start the worker.
2. Sign in to [QUN Studio](https://serega40in.github.io/QUN/studio/).
3. Submit a **Проверка очереди** job first. It succeeds only when the worker can reach ComfyUI.
4. Submit a short image or video job only after the workflow has been configured and tested.
5. Check the job status in the studio. Successful results contain output URLs served by ComfyUI.

## Known limits in this stage

- Output URLs are served by the configured ComfyUI host. A private/local host URL cannot be opened from a phone or another device unless network access is configured. The next stage should upload artifacts to private QUN Storage and expose short-lived signed links.
- A single configured workflow is used by default. Image/video/audio pipelines should be validated separately; audio support depends on the chosen workflow's output node.
- This is a first production-oriented adapter, not a claim that end-to-end cloud generation has been tested. Validate the exact workflow and GPU endpoint before relying on it for production.


## FFmpeg assembly

Install FFmpeg on the same machine as the worker and verify `ffmpeg -version` works. Set `QUN_COMFYUI_OUTPUT_DIR` to the actual ComfyUI `output` directory (not the worker's folder); optionally set `QUN_FFMPEG_PATH` if FFmpeg is not on PATH.

After at least two video scene jobs succeed, use **Собрать MP4** in QUN Director. The page queues a `comfyui_workflow` job with `requirements.operation = "assemble_video"` and the output metadata from completed jobs. The worker accepts filenames only, rejects path traversal, and resolves files strictly inside `QUN_COMFYUI_OUTPUT_DIR`. A completed music job is muxed into the MP4; otherwise the clip is assembled without music. Scene clips need compatible codecs for FFmpeg stream-copy concatenation.

The final MP4 is saved in the ComfyUI output directory and returned as a ComfyUI `/view` URL. It is not yet uploaded to private QUN Storage; a local ComfyUI URL is only accessible from a browser that can reach that server.



## Windows CPU-only node (assembly without ComfyUI)

A Windows PC without a suitable AI GPU can still run the final FFmpeg assembly for scenes that already exist in QUN Storage. This node does not generate Wan/ComfyUI AI scenes and does not need ComfyUI or model downloads. It only claims owner-scoped `comfyui_workflow` jobs whose `requirements.operation` is `assemble_video`.

Requirements: Python 3, Git, FFmpeg and ffprobe available in PATH, and a Windows PC that can stay online while jobs run. Check them in PowerShell with `python --version`, `git --version`, `ffmpeg -version` and `ffprobe -version`. If Git or FFmpeg is missing, install with WinGet: `winget install -e --id Git.Git` and `winget install -e --id Gyan.FFmpeg`. Then open a new PowerShell window.

```powershell
git clone --depth 1 https://github.com/Serega40in/QUN.git "$HOME\QUN"
cd "$HOME\QUN\docs\studio"
$env:QUN_SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY"
$env:QUN_NODE_PLATFORM = "windows-cpu"
python .\register_gpu_worker.py
$env:QUN_FFMPEG_PATH = "ffmpeg"
$env:QUN_FFPROBE_PATH = "ffprobe"
$env:QUN_COMFYUI_OUTPUT_DIR = "$HOME\QUN-Render-Output"
python .\comfyui_worker.py
```

The enrollment code is issued by the signed-in QUN account on the Render Node page. The registration script saves the node secret locally in the user's QUN configuration directory. Do not copy that secret into chat, GitHub or a web page.

When the worker is online, QUN Director can submit final assembly jobs to it. The worker downloads only the selected signed QUN Storage assets, joins scenes with FFmpeg, trims the soundtrack to the selected 10/30/60-second setting or uses the full track, compresses the result to the safe QUN Storage size budget, then uploads it to the owner's private Library. CPU-only mode is for editing/assembly; AI video generation still needs an AI-capable GPU node or an available external generator.
