$ErrorActionPreference = 'Stop'
$tokenPath = Join-Path $env:APPDATA 'QUNAgentBridge\bridge-token.dpapi'
$secureToken = $null
$bstr = [IntPtr]::Zero
$plain = $null
$wasGenerated = $false

try {
  if (Test-Path -LiteralPath $tokenPath) {
    try {
      $encrypted = [System.IO.File]::ReadAllText($tokenPath).Trim()
      $secureToken = ConvertTo-SecureString -String $encrypted
      $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
      $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
      if ($plain -notmatch '^[a-fA-F0-9]{64}$') { throw 'Saved token format is invalid.' }
    }
    catch {
      if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr); $bstr = [IntPtr]::Zero }
      if ($secureToken) { $secureToken.Dispose(); $secureToken = $null }
      $plain = $null
    }
  }

  if (-not $plain) {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $plain = -join ($bytes | ForEach-Object { $_.ToString('x2') })
    $secureToken = ConvertTo-SecureString -String $plain -AsPlainText -Force
    $encrypted = ConvertFrom-SecureString -SecureString $secureToken
    New-Item -ItemType Directory -Path (Split-Path -Parent $tokenPath) -Force | Out-Null
    [System.IO.File]::WriteAllText($tokenPath, $encrypted, [System.Text.UTF8Encoding]::new($false))
    $wasGenerated = $true
  }

  Set-Clipboard -Value $plain
  if ($wasGenerated) {
    Write-Host 'A new QUN Agent Bridge token was generated and copied to the clipboard.' -ForegroundColor Yellow
    Write-Host 'First paste it into the QUN Agent Bridge Chrome extension and click Save/Connect. Then run this helper again to copy it for Claude Desktop.'
  } else {
    Write-Host 'The saved QUN Agent Bridge token was copied to the clipboard without printing it.' -ForegroundColor Green
    Write-Host 'Paste it into the Browser bridge token field in the Claude Desktop extension installer.'
  }
  Write-Host 'Do not paste the token into a chat or commit it to GitHub.'
}
catch {
  Write-Host ('Token helper failed: ' + $_.Exception.Message) -ForegroundColor Red
  exit 1
}
finally {
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  if ($secureToken) { $secureToken.Dispose() }
  $plain = $null
}
