@echo off
setlocal
cd /d "%~dp0"
title QUN Sticker Studio

echo.
echo  QUN Sticker Studio
echo  ------------------
echo.

where py >nul 2>nul
if errorlevel 1 (
    where python >nul 2>nul
    if errorlevel 1 (
        echo Python 3.10 or newer was not found.
        echo Install Python from https://www.python.org/downloads/windows/
        echo During installation, enable "Add python.exe to PATH".
        pause
        exit /b 1
    )
    set "PY=python"
) else (
    set "PY=py -3"
)

if exist "backend\ComfyUI\main.py" if exist "backend\ComfyUI\venv\Scripts\python.exe" (
    if exist "backend\ComfyUI\models\checkpoints\*.safetensors" (
        echo Starting installed ComfyUI CPU backend in a separate window...
        start "QUN ComfyUI CPU" cmd /k ""%~dp0start_comfyui_cpu.bat""
    ) else if exist "backend\ComfyUI\models\checkpoints\*.ckpt" (
        echo Starting installed ComfyUI CPU backend in a separate window...
        start "QUN ComfyUI CPU" cmd /k ""%~dp0start_comfyui_cpu.bat""
    ) else (
        echo ComfyUI is installed but no checkpoint was found.
        echo The Studio will start in file-management mode.
    )
)

echo.
echo Starting local browser studio...
echo Address: http://127.0.0.1:8791
echo Keep this window open while using the Studio.
echo Press Ctrl+C or close this window to stop the local server.
echo.

%PY% app.py --open
if errorlevel 1 (
    echo.
    echo The Studio stopped with an error. See the message above.
    pause
)

endlocal
