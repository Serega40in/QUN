[CmdletBinding()]
param(
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA "QUN\QUN"),
  [switch]$SkipPrerequisiteInstall
)
$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/Serega40in/QUN.git"
$NodeDir = Join-Path $InstallDir "services\qun-node"
function Test-Command([string]$Name) { return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue) }
Write-Host ""
Write-Host " QUN Node - установщик раннего доступа" -ForegroundColor Cyan
Write-Host " Источник: $RepoUrl"
Write-Host " Данные узла: $(Join-Path $InstallDir 'data')"
Write-Host "Важно: это открытый PowerShell-установщик, не подписанный MSI. Он не подключает компьютер к публичной сети и не начисляет QUN." -ForegroundColor Yellow
$answer = Read-Host "Продолжить? (y/N)"
if ($answer -notin @("y", "Y", "д", "Д")) { Write-Host "Установка отменена."; exit 0 }
$nodeMajor = 0
if (Test-Command "node") { try { $nodeMajor = [int](node -p "process.versions.node.split('.')[0]") } catch {} }
if ($nodeMajor -lt 20) {
  if ($SkipPrerequisiteInstall) { throw "Нужен Node.js 20+. Установите LTS-версию с https://nodejs.org/." }
  if (Test-Command "winget") {
    winget install --id OpenJS.NodeJS.LTS --exact --source winget --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw "Установка Node.js не удалась. Установите Node.js LTS вручную: https://nodejs.org/" }
    $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
  } else { throw "Node.js 20+ не найден и winget недоступен. Установите Node.js LTS с https://nodejs.org/." }
}
if (-not (Test-Command "git")) {
  if ($SkipPrerequisiteInstall) { throw "Нужен Git: https://git-scm.com/download/win." }
  if (Test-Command "winget") {
    winget install --id Git.Git --exact --source winget --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw "Установка Git не удалась. Установите Git вручную." }
    $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
  } else { throw "Git не найден и winget недоступен. Установите Git: https://git-scm.com/download/win." }
}
New-Item -ItemType Directory -Force -Path (Split-Path $InstallDir -Parent) | Out-Null
if (-not (Test-Path (Join-Path $InstallDir ".git"))) {
  if (Test-Path $InstallDir) {
    if ((Get-ChildItem -Force $InstallDir | Measure-Object).Count -gt 0) { throw "Каталог $InstallDir существует и не является репозиторием Git. Выберите другой InstallDir." }
  }
  git clone --depth 1 $RepoUrl $InstallDir
  if ($LASTEXITCODE -ne 0) { throw "Не удалось клонировать репозиторий QUN." }
} else { Write-Host "Репозиторий уже установлен. Автоматическое обновление кода не выполняется." }
Set-Location $NodeDir
$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 20) { throw "Нужен Node.js 20+. Перезапустите PowerShell после установки." }
New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir "data") | Out-Null
$env:QUN_NODE_HOST = "127.0.0.1"
$env:QUN_NODE_PORT = "8787"
$env:QUN_NODE_DATA_DIR = Join-Path $InstallDir "data"
Write-Host "Проверяем QUN Node..." -ForegroundColor Cyan
npm test
if ($LASTEXITCODE -ne 0) { throw "Автотесты не прошли. Узел не будет запущен." }
Write-Host "Панель: http://127.0.0.1:8787/"
Write-Host "Остановка: Ctrl+C. Это пока не установка службы Windows."
npm start
