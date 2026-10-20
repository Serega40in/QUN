@echo off
setlocal EnableExtensions
title QUN Compute Worker
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 goto use_py
where python >nul 2>nul
if errorlevel 1 goto no_python
set "PYTHON=python"
goto python_ready
:use_py
set "PYTHON=py -3"
:python_ready
if exist "%USERPROFILE%\.qun-compute-node\credentials.json" goto run_worker
echo.
echo QUN Compute Worker first-time registration
set /p "QUN_ENROLLMENT_CODE=Paste the one-time compute enrollment code: "
if not defined QUN_ENROLLMENT_CODE goto no_code
set /p "QUN_NODE_NAME=Worker name [QUN Compute Worker]: "
if not defined QUN_NODE_NAME set "QUN_NODE_NAME=QUN Compute Worker"
%PYTHON% worker.py --register
if errorlevel 1 goto failed
:run_worker
%PYTHON% worker.py
if errorlevel 1 goto failed
goto end
:no_python
echo Python 3.11 or newer is required. Install it from https://www.python.org/downloads/windows/
goto failed
:no_code
echo No code entered.
goto failed
:failed
echo.
echo Worker stopped or returned an error. Read the message above.
pause
:end
endlocal
