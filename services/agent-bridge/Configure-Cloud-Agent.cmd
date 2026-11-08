@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Configure-Cloud-Agent.ps1"
if errorlevel 1 (
  echo.
  echo Setup did not complete. Read the error above.
)
echo.
pause
endlocal
