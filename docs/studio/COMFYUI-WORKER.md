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

The worker still runs only workflows you configured. It does not download models, install custom nodes, or expose your ComfyUI server. Audio outputs are detected when the ComfyUI history reports `audio` or `audio_files` entries. A multi-scene music video still needs an assembly stage (for example FFmpeg) to combine scene clips, soundtrack and dialogue into one final file; separate workflow routing is the execution foundation, not a claim that automatic final montage is already complete.

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
