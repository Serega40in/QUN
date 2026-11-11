@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Run-AgentService.ps1"
if errorlevel 1 (
  echo.
  echo QUN Agent Core stopped with an error. Read the message above.
  pause
)
endlocal
