$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 20+ is required. Install it from https://nodejs.org/ and rerun this script.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm was not found. Repair the Node.js installation and rerun this script.' }
Write-Host 'Installing QUN Desktop Agent dependencies...' -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
npm run check
if ($LASTEXITCODE -ne 0) { throw 'JavaScript syntax checks failed.' }
$Electron = Join-Path $Root 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $Electron)) { throw 'Electron executable was not installed.' }
$Desktop = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $Desktop 'QUN Desktop Agent.lnk'
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Electron
$Shortcut.Arguments = '.'
$Shortcut.WorkingDirectory = $Root
$Shortcut.Description = 'Launch QUN Desktop Agent'
$Shortcut.Save()
Write-Host "Installed. Desktop shortcut: $ShortcutPath" -ForegroundColor Green
Write-Host 'Launch the app from the desktop shortcut. Add your own API endpoint, model ID, and API key inside the app.' -ForegroundColor Gray
if ($env:QUN_LAUNCH -eq '1') { Start-Process -FilePath $Electron -ArgumentList '.' -WorkingDirectory $Root }
