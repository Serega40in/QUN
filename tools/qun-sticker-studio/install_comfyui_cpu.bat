@echo off
setlocal
cd /d "%~dp0"
title QUN Sticker Studio - Install ComfyUI CPU

echo.
echo  This installer downloads ComfyUI and the CPU build of PyTorch.
echo  It may use several gigabytes of disk space and can take a while.
echo  It does NOT download an image model/checkpoint.
echo.
choice /C YN /M "Continue with CPU backend installation"
if errorlevel 2 exit /b 0

where py >nul 2>nul
if errorlevel 1 (
  echo Python Launcher was not found. Install Python 3.12 from https://www.python.org/downloads/windows/
  pause
  exit /b 1
)
py -3.12 --version >nul 2>nul
if errorlevel 1 (
  echo Python 3.12 is required for this tested setup.
  echo Install Python 3.12, then run this file again.
  pause
  exit /b 1
)

if not exist "backend" mkdir backend
if not exist "backend\ComfyUI\main.py" (
  echo Downloading ComfyUI source...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://github.com/Comfy-Org/ComfyUI/archive/refs/heads/master.zip' -OutFile 'backend\comfyui-source.zip'"
  if errorlevel 1 (
    echo Download failed. Check internet access.
    pause
    exit /b 1
  )
  echo Extracting...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath 'backend\comfyui-source.zip' -DestinationPath 'backend' -Force; Move-Item -LiteralPath 'backend\ComfyUI-master' -Destination 'backend\ComfyUI' -Force; Remove-Item 'backend\comfyui-source.zip' -Force"
  if errorlevel 1 (
    echo Extract failed.
    pause
    exit /b 1
  )
)

if not exist "backend\ComfyUI\venv\Scripts\python.exe" (
  echo Creating Python environment...
  py -3.12 -m venv backend\ComfyUI\venv
  if errorlevel 1 (
    echo Virtual environment creation failed.
    pause
    exit /b 1
  )
)

echo Updating pip...
backend\ComfyUI\venv\Scripts\python.exe -m pip install --upgrade pip
if errorlevel 1 (
  echo pip update failed.
  pause
  exit /b 1
)

echo Installing CPU-only PyTorch. This is a large download...
backend\ComfyUI\venv\Scripts\python.exe -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
if errorlevel 1 (
  echo PyTorch installation failed.
  pause
  exit /b 1
)

echo Installing ComfyUI requirements...
backend\ComfyUI\venv\Scripts\python.exe -m pip install -r backend\ComfyUI\requirements.txt
if errorlevel 1 (
  echo ComfyUI requirements installation failed.
  pause
  exit /b 1
)

echo.
echo ComfyUI CPU backend installed.
echo Next: download a compatible checkpoint and place it in:
echo backend\ComfyUI\models\checkpoints\
echo Then run start_windows.bat. It will open ComfyUI and the Studio when the model is present.
echo.
pause
endlocal
