@echo off
setlocal
cd /d "%~dp0"
title QUN Sticker Studio - ComfyUI CPU
if not exist "backend\ComfyUI\main.py" (
  echo ComfyUI is not installed. Run install_comfyui_cpu.bat first.
  pause
  exit /b 1
)
if not exist "backend\ComfyUI\venv\Scripts\python.exe" (
  echo ComfyUI Python environment is missing. Run install_comfyui_cpu.bat again.
  pause
  exit /b 1
)
if not exist "backend\ComfyUI\models\checkpoints\*.safetensors" if not exist "backend\ComfyUI\models\checkdoints\*.ckpt" (
  echo No checkpoint was found in backend\ComfyUI\models\checkpoints.
  echo Download a compatible model first. Read docs\stickers\README.md.
  pause
  exit /b 1
)
echo Starting ComfyUI on CPU at http://127.0.0.1:8188
echo This mode is slow. Keep this window open while generating.
cd /d "backend\ComfyUI"
venv\Scripts\python.exe main.py --cpu --listen 127.0.0.1 --port 8188
endlocal
