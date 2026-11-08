$ErrorActionPreference = "Stop"

$AppDataDir = Join-Path $env:APPDATA "QUNAgentBridge"
$BridgeTokenPath = Join-Path $AppDataDir "bridge-token.dpapi"
$DeviceKeyPath = Join-Path $AppDataDir "device-key.dpapi"
$AgentScript = Join-Path $PSScriptRoot "..\src\agent-service.js"
$CloudUrl = "https://qdxjltqlnphvzafapncm.supabase.co/functions/v1/qun-agent-core"

function Read-PlainSecret([string]$Path) {
    $secure = $null
    $ptr = [IntPtr]::Zero
    try {
        $encrypted = [System.IO.File]::ReadAllText($Path).Trim()
        $secure = ConvertTo-SecureString -String $encrypted
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
        if ($secure) { $secure.Dispose() }
    }
}

$browserToken = $null
$deviceKey = $null
try {
    if (-not (Test-Path -LiteralPath $BridgeTokenPath) -or -not (Test-Path -LiteralPath $DeviceKeyPath)) {
        throw "Local keys are missing. Run Configure-Cloud-Agent.cmd first."
    }
    if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
        throw "Node.js was not found. Install Node.js 20+ and reopen this window."
    }
    if (-not (Test-Path -LiteralPath $AgentScript)) {
        throw "Agent script was not found: $AgentScript"
    }

    $browserToken = Read-PlainSecret $BridgeTokenPath
    $deviceKey = Read-PlainSecret $DeviceKeyPath
    if ($browserToken -notmatch '^[a-fA-F0-9]{64}$' -or $deviceKey -notmatch '^[a-fA-F0-9]{64}$') {
        throw "Stored key format is invalid. Run Configure-Cloud-Agent.cmd again."
    }

    $env:QUN_AGENT_TOKEN = $browserToken
    $env:QUN_AGENT_DEVICE_KEY = $deviceKey
    $env:QUN_AGENT_CLOUD_URL = $CloudUrl
    $env:QUN_AGENT_DEVICE_ID = "windows-main"
    $env:QUN_AGENT_DEVICE_NAME = "QUN Windows"

    Write-Host "Starting QUN Agent Core local worker..." -ForegroundColor Cyan
    Write-Host "Keep this window open for the first test. Local dashboard: http://127.0.0.1:43127/"
    Write-Host "Press Ctrl+C to stop."
    & node.exe $AgentScript
    if ($LASTEXITCODE -ne 0) { throw "QUN Agent Core exited with code $LASTEXITCODE." }
}
catch {
    Write-Host ""
    Write-Host ("QUN Agent Core startup failed: " + $_.Exception.Message) -ForegroundColor Red
    Write-Host "Check that the Edge Function secrets QUN_AGENT_DEVICE_KEY and QUN_AGENT_MCP_KEY are saved in Supabase."
    exit 1
}
finally {
    Remove-Item Env:QUN_AGENT_TOKEN -ErrorAction SilentlyContinue
    Remove-Item Env:QUN_AGENT_DEVICE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:QUN_AGENT_CLOUD_URL -ErrorAction SilentlyContinue
    Remove-Item Env:QUN_AGENT_DEVICE_ID -ErrorAction SilentlyContinue
    Remove-Item Env:QUN_AGENT_DEVICE_NAME -ErrorAction SilentlyContinue
    $browserToken = $null
    $deviceKey = $null
}

