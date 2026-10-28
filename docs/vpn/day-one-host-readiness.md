# QUN VPN — Day 1 host readiness

This checklist prepares a small, private WireGuard network for explicitly authorized QUN devices. It does not deploy anything or change firewall/network settings.

## Non-negotiable guardrails
- Do not provision paid infrastructure without explicit owner approval.
- Do not publish endpoint IPs, private keys, client profiles, QR codes, provider tokens, or unredacted diagnostics.
- One unique key pair per device; revoke a peer when a device is lost or access ends.
- Keep the admin plane private. Default-deny firewall; expose only the WireGuard UDP port and explicitly approved services.
- Start with split tunneling and narrow AllowedIPs; do not route all traffic through the VPN by default.
- WireGuard VPN and HAPP/proxy compatibility are separate workstreams.

## Step 1 — Identify the host
Choose an existing Linux host that the project owner is authorized to administer. Before any changes, record locally (not in a public issue or repository):
- Linux distribution/version and kernel
- Whether the host has a reachable public IPv4 or IPv6 address
- Whether UDP inbound traffic can be allowed by the host firewall and provider firewall
- SSH recovery path and console access
- Whether configuration survives reboot
- Whether this host already runs services that must not be interrupted

## Step 2 — Read-only preflight (run on the candidate Linux host)
These commands only inspect state; they do not install packages or change networking.

```sh
set -eu
printf '\n== OS ==\n'
cat /etc/os-release
printf '\n== Kernel ==\n'
uname -r
printf '\n== Interfaces and routes ==\n'
ip -brief address
ip route
printf '\n== WireGuard tools ==\n'
if command -v wg >/dev/null 2>&1; then wg --version; else echo 'wg not installed'; fi
printf '\n== Existing WireGuard interface ==\n'
if command -v wg >/dev/null 2>&1; then sudo wg show; else echo 'not checked: wg unavailable'; fi
printf '\n== Firewall tooling (presence only) ==\n'
for tool in nft ufw firewall-cmd; do command -v "$tool" || true; done
printf '\n== Disk space ==\n'
df -h /
```

Review the output locally. Before sharing, redact hostnames, addresses, usernames, routes, and any unrelated service details. Never send private keys or the contents of WireGuard configuration files.

## Step 3 — Deployment gate
Do not install or configure WireGuard until all are true:
- The owner confirms this is the intended host and authorizes changes.
- A recovery path is available in case firewall changes interrupt SSH.
- The existing firewall and active services have been reviewed.
- The VPN subnet and permitted destination routes are chosen to avoid overlap.
- The WireGuard UDP port and DNS plan are explicitly decided.

## Step 4 — Device validation
For Windows and Android, install the official WireGuard client, create separate device keys, and transfer profiles through a private channel. Validate:
- Handshake and expected routes
- Only approved private resources are reachable
- DNS behavior and IPv4/IPv6 leakage behavior
- Peer revocation immediately removes access
- Host reboot and tested backup/restore

## Current status
Repository runbook exists; no server has been provisioned and no live network has been changed. This checklist is preparation only, not proof of a working VPN.
