@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Copy-Token-To-Clipboard.ps1"
echo.
pause
endlocal
