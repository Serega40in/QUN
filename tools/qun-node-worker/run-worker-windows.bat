@echo off
setlocal
title QUN Compute Worker
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python 3 is required. Install Python 3.11+ from https://www.python.org/downloads/windows/
    pause
    exit /b 1
  )
  set "PYTHON=python"
) else (
  set "PYTHON=py -3"
)
if not exist "%USERPROFILE%\.qun-compute-node\credentials.json" (
  echo This is a one-time registration for the QUN Compute Worker.
  set /p QUN_ENROLLMENT_CODE=Paste the one-time compute enrollment code: 
  if not defined QUN_ENROLLMENT_CODE (
    echo No code entered.
    pause
    exit /b 1
  )
  set /p QUN_NODE_NAME=Worker name [QUN Compute Worker]: 
  if not defined QUN_NODE_NAME set "QUN_NODE_NAME=QUN Compute Worker"
  %PYTHON% worker.py --register
) else (
  %PYTHON% worker.py
)
if errorlevel 1 (
  echo.
  echo Worker exited with an error. Read the message above.
  pause
)
endlocal
