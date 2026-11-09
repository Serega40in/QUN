# QUN Sticker Studio (local)

A small local web app for preparing sticker packs and sending text-to-image jobs to a local ComfyUI instance. It runs on Windows and opens in the browser.

## Start

1. Install Python 3.10 or newer (Python 3.12 is a good default).
2. Double-click `start_windows.bat`.
3. The browser opens at `http://127.0.0.1:8791`.
4. Import existing PNG/WebP files or connect ComfyUI to generate new candidates.
5. Select approved images and export a ZIP with a manifest.

No Python packages are needed for the Studio server itself; it uses the Python standard library.

## Optional image backend (CPU)

If you want to test generation on this PC, run `install_comfyui_cpu.bat` once. It installs ComfyUI and CPU-only PyTorch into this folder. This downloads several gigabytes and requires Python 3.12, internet access, and free disk space. The script does **not** download a model.

Then place a compatible checkpoint in `backend/ComfyUI/models/checkpoints/` and double-click `start_windows.bat`. It opens the ComfyUI CPU backend in a separate console window, then opens the Studio in your browser. Keep both console windows open while generating.

For the first experiment, use one 512×512 image and a lightweight SD 1.5 checkpoint. The SD 1.5 model is licensed under CreativeML OpenRAIL-M; review its usage restrictions before any commercial use. The model is not bundled or downloaded automatically. [Model card](https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5).

**Hardware note:** with 8 GB RAM and Intel HD Graphics 505, CPU generation may be extremely slow or run out of memory. Start with a single image, close other applications, and stop if Windows begins heavy paging. For a full 24-sticker batch, a free hosted GPU notebook is more realistic when available.

## Connect ComfyUI

The Studio expects ComfyUI API at `http://127.0.0.1:8188`. The Studio checks whether it is reachable and requests the available checkpoint names. The Generate tab uses a simple standard ComfyUI workflow (`CheckpointLoaderSimple`, `CLIPTextEncode`, `KSampler`, `VAEDecode`, `SaveImage`).

You must install and start ComfyUI separately, and place a compatible checkpoint in `ComfyUI/models/checkpoints/`. The Studio does not silently download a model or install a large AI runtime.

For a local CPU test, ComfyUI supports the `--cpu` launch flag, but its own documentation describes this mode as slow. Do not expect practical bulk generation on a PC with 8 GB RAM and an older integrated GPU. Use a free GPU notebook for the first full batch when available.

## Output folders

- `output/imported/`: files imported into the Studio.
- `output/export/`: ZIP packages created by the Studio.
- ComfyUI's generated files remain in the ComfyUI output folder until you save them into the Studio library from the page.

## Security

- The HTTP server binds only to `127.0.0.1` (this computer).
- No public endpoint, login, database, analytics, or automatic cloud upload is included.
- Do not change the bind address to `0.0.0.0` or expose port 8791 to the internet.
- Never put private API keys or Supabase service-role keys in this local page.
- The ComfyUI API is assumed to be a local trusted service.

## Limitations of version 0.1

- It creates prompt jobs and manages image candidates; it is not a full image editor.
- Background removal, hand retouching, vector editing, and advanced character-reference workflows are separate steps.
- ComfyUI model compatibility varies. This initial API workflow is for ordinary checkpoint-based models such as SD 1.5; it is not a Z-Image/FLUX workflow.
- The Studio does not publish to Telegram or QUN automatically. It prepares a ZIP so a human can review it first.

See [the full sticker standard](../../docs/stickers/README.md).
