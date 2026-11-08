$ErrorActionPreference = "Stop"

$tokenPath = Join-Path $env:APPDATA "QUNAgentBridge\bridge-token.dpapi"
if (-not (Test-Path -LiteralPath $tokenPath)) {
    [Console]::Error.WriteLine("QUN Agent Bridge: token is not configured. Run SETUP-QUN-AGENT-BRIDGE.cmd first.")
    exit 1
}

$plainToken = $null
$secureToken = $null
$bstr = [IntPtr]::Zero

try {
    $encryptedToken = [System.IO.File]::ReadAllText($tokenPath).Trim()
    $secureToken = ConvertTo-SecureString -String $encryptedToken
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

    if ($plainToken -notmatch '^[a-fA-F0-9]{64}$') {
        throw "Saved token is invalid. Run SETUP-QUN-AGENT-BRIDGE.cmd again and enter the same token as the browser extension."
    }

    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $node) {
        throw "Node.js was not found. Install Node.js 20+ and restart ChatGPT Desktop."
    }

    $serverPath = Join-Path $PSScriptRoot "..\src\index.js"
    if (-not (Test-Path -LiteralPath $serverPath)) {
        throw "MCP server file was not found: $serverPath"
    }

    $env:QUN_AGENT_TOKEN = $plainToken
    & $node.Source $serverPath
    $exitCode = $LASTEXITCODE
}
catch {
    [Console]::Error.WriteLine("QUN Agent Bridge startup error: " + $_.Exception.Message)
    $exitCode = 1
}
finally {
    Remove-Item Env:QUN_AGENT_TOKEN -ErrorAction SilentlyContinue
    $plainToken = $null
    if ($bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    if ($secureToken) {
        $secureToken.Dispose()
    }
}

if ($null -eq $exitCode) { $exitCode = 1 }
exit $exitCode
