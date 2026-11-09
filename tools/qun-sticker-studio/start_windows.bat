@echo off
setlocal
cd /d "%~dp0"

title QUN Sticker Studio
echo.
echo  QUN Sticker Studio
echo  ------------------
echo.

where py >nul 2>nul
if %errorlevel%==0 (
    set "PY=py -3"
) else (
    where python >nul 2>nul
    if %errorlevel%==0 (
        set "PY=python"
    ) else (
        echo Python 3.10 or newer was not found.
        echo Install Python from https://www.python.org/downloads/windows/
        echo During installation, enable "Add python.exe to PATH".
        pause
        exit /b 1
    )
)

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
