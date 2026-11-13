@echo off
setlocal
pushd "%~dp0.."
if not exist "node_modules\electron\dist\electron.exe" (
  echo QUN Desktop Agent is not installed yet.
  echo Run: powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
  pause
  popd
  exit /b 1
)
start "" "node_modules\electron\dist\electron.exe" .
popd
endlocal
