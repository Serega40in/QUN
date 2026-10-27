# QUN VPN read-only Windows preflight
# Run in PowerShell. This script does not install software, change routes, start/stop services,
# display keys, or send diagnostics anywhere.
$ErrorActionPreference = "SilentlyContinue"

Write-Host "QUN VPN — Windows read-only preflight" -ForegroundColor Cyan
Write-Host "No settings will be changed and no secrets will be printed."
Write-Host ""

$wg = Get-Command "wg.exe" -ErrorAction SilentlyContinue
$wireGuardCandidates = @(
  "$env:ProgramFiles\WireGuard\wireguard.exe",
  "${env:ProgramFiles(x86)}\WireGuard\wireguard.exe"
)
$gui = $wireGuardCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($wg) {
  Write-Host "[FOUND] wg.exe command is available"
} else {
  Write-Host "[INFO] wg.exe is not on PATH"
}
if ($gui) {
  Write-Host "[FOUND] WireGuard Windows application is installed"
} else {
  Write-Host "[INFO] WireGuard GUI was not found in standard install paths"
}

$wgAdapters = @(Get-NetAdapter | Where-Object {
  $_.InterfaceDescription -match "WireGuard" -or $_.Name -match "WireGuard"
})
if ($wgAdapters.Count -gt 0) {
  Write-Host "[FOUND] WireGuard network adapter(s): $($wgAdapters.Count)"
  $wgAdapters | ForEach-Object {
    Write-Host ("  adapter status: {0}" -f $_.Status)
  }
} else {
  Write-Host "[INFO] No WireGuard adapter is currently visible"
}

$wgInterfaces = @()
if ($wg) {
  # Interface names only; never call commands that print private keys or peer details.
  $raw = & $wg.Source show interfaces 2>$null
  if ($LASTEXITCODE -eq 0 -and $raw) {
    $wgInterfaces = @((($raw -join "`n") -split '\s+') | Where-Object { $_ })
  }
}
if ($wgInterfaces.Count -gt 0) {
  Write-Host "[FOUND] WireGuard reports $($wgInterfaces.Count) interface(s)"
} else {
  Write-Host "[INFO] No active WireGuard interface reported by wg.exe"
}

$dnsConfigured = $false
$dnsAdapters = @(Get-DnsClientServerAddress | Where-Object {
  $_.InterfaceAlias -match "WireGuard" -and $_.ServerAddresses.Count -gt 0
})
if ($dnsAdapters.Count -gt 0) {
  $dnsConfigured = $true
}
if ($dnsConfigured) {
  Write-Host "[FOUND] DNS server configuration exists on a WireGuard-named interface (addresses hidden)"
} else {
  Write-Host "[INFO] No DNS server configuration found on a WireGuard-named interface"
}

Write-Host ""
Write-Host "Next: import an authorized test profile using the official WireGuard app, connect, then rerun this script."
Write-Host "This preflight does not prove a handshake, public egress, DNS leak status, or IPv6 leak status."
