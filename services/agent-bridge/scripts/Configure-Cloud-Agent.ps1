$ErrorActionPreference = "Stop"

$AppDataDir = Join-Path $env:APPDATA "QUNAgentBridge"
$BridgeTokenPath = Join-Path $AppDataDir "bridge-token.dpapi"
$DeviceKeyPath = Join-Path $AppDataDir "device-key.dpapi"
$McpKeyPath = Join-Path $AppDataDir "mcp-key.dpapi"
$SecretsUrl = "https://supabase.com/dashboard/project/qdxjltqlnphvzafapncm/functions/secrets"

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

function Save-PlainSecret([string]$Path, [string]$Value) {
    $secure = ConvertTo-SecureString -String $Value -AsPlainText -Force
    try {
        $encrypted = ConvertFrom-SecureString -SecureString $secure
        [System.IO.File]::WriteAllText($Path, $encrypted, [System.Text.UTF8Encoding]::new($false))
    }
    finally {
        $secure.Dispose()
    }
}

function New-HexKey {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return -join ($bytes | ForEach-Object { $_.ToString("x2") })
}

function Get-OrCreateKey([string]$Path) {
    if (Test-Path -LiteralPath $Path) {
        $existing = Read-PlainSecret $Path
        if ($existing -match '^[a-fA-F0-9]{64}$') { return $existing }
    }
    $created = New-HexKey
    Save-PlainSecret $Path $created
    return $created
}

try {
    New-Item -ItemType Directory -Path $AppDataDir -Force | Out-Null
    Write-Host ""
    Write-Host "QUN Agent Core — одноразовая настройка" -ForegroundColor Cyan
    Write-Host "Ключи будут сохранены в зашифрованном DPAPI-виде для текущего пользователя Windows."
    Write-Host "Не отправляй ключи в чаты и не сохраняй их в GitHub."
    Write-Host ""

    if (-not (Test-Path -LiteralPath $BridgeTokenPath)) {
        Write-Host "Не найден локальный токен браузерного расширения." -ForegroundColor Yellow
        $browserSecure = Read-Host "Вставь исходный 64-символьный токен из npm run token" -AsSecureString
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($browserSecure)
        try { $browserPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
        finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
            $browserSecure.Dispose()
        }
        if ($browserPlain -notmatch '^[a-fA-F0-9]{64}$') { throw "Токен браузера должен быть 64 hex-символа." }
        Save-PlainSecret $BridgeTokenPath $browserPlain
        $browserPlain = $null
    }

    $deviceKey = Get-OrCreateKey $DeviceKeyPath
    $mcpKey = Get-OrCreateKey $McpKeyPath

    Write-Host ""
    Write-Host "Открой секреты проекта QUN в Supabase:" -ForegroundColor Cyan
    Write-Host $SecretsUrl
    Write-Host "Добавь ключ QUN_AGENT_DEVICE_KEY. Его значение сейчас скопировано в буфер обмена."
    Set-Clipboard -Value $deviceKey
    [void](Read-Host "После сохранения QUN_AGENT_DEVICE_KEY в Supabase нажми Enter")
    Set-Clipboard -Value $mcpKey
    Write-Host ""
    Write-Host "Теперь в буфере значение QUN_AGENT_MCP_KEY. Добавь секрет с этим именем в Supabase."
    [void](Read-Host "После сохранения QUN_AGENT_MCP_KEY нажми Enter")
    Set-Clipboard -Value ""
    Write-Host ""
    Write-Host "Настройка ключей завершена." -ForegroundColor Green
    Write-Host "Токен браузера и два новых ключа хранятся в зашифрованных DPAPI-файлах внутри %APPDATA%\QUNAgentBridge."
    Write-Host "Следующий шаг: запусти Start-QUN-AGENT-CORE.cmd."
    Write-Host "Если Supabase сохранил секреты, но функция ещё не видит их, открой /health и проверь authenticationConfigured."
}
catch {
    Write-Host ""
    Write-Host ("Настройка не завершена: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
finally {
    $deviceKey = $null
    $mcpKey = $null
}
