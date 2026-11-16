# QUN VPN — free VPS candidate evaluation

Status: candidate only. No provider account or VPS has been created, and no payment or billable resource has been initiated.

## Candidate: switched.cloud

Public product page: https://switched.cloud/

The public page currently advertises:
- Debian 13 or Alpine Linux; root access over SSH.
- Five assigned TCP/UDP ports on a shared IPv4 address, plus a per-VPS IPv6 address.
- Advertised ceilings of 400% shared CPU, 12 GB shared memory, and 50 GB disk; allocations depend on capacity and are not performance guarantees.
- Three initial days of runtime. One Cloud Token adds one day; each VPS consumes runtime continuously, including when shut down. When runtime expires, the VPS stops; if not replenished within three days it is deleted.
- No provider backups; the operator must keep their own copies.
- No crypto mining, attacks, or spam; other restrictions are in the provider's Acceptable Use Policy.

Source: provider product page, checked 2026-10-28: https://switched.cloud/

## Decision: do not deploy a VPN until two gates are passed

1. **Policy gate:** Before creating a VPS, inspect and accept the provider's current Terms and Acceptable Use Policy. Confirm directly from the provider that a personal VLESS/Xray proxy or VPN is permitted on the free shared-host plan. The product page alone does not explicitly confirm this. If policy is unclear, ask support first; do not try to hide the traffic or bypass provider restrictions.
2. **Connectivity gate:** After the user creates the VPS, verify the assigned TCP/UDP ports, inbound IPv4/IPv6 reachability, SSH access, and whether the assigned port can be used by the chosen protocol. Do not assume TCP/UDP port 443 or any conventional VPN port is available.

## QUN / Happ target

The intended experience remains: QUN VPN web page on GitHub Pages → tap **Open in Happ** → Happ imports a valid QUN profile → the client establishes a real connection.

GitHub Pages hosts the interface only. It cannot provide the VPN data plane. A server-side profile and a reachable compatible service are required. The current QUN page must continue to show that no QUN server is connected until the end-to-end connection is verified.

A possible technical candidate after the gates pass is an Xray-compatible VLESS profile. Protocol, transport, port, TLS/Reality settings, and IPv6 behavior must be selected based on the actual host allocation and tested with Happ; they must not be hard-coded before the server exists.

## Security rules

- Never commit private keys, UUIDs intended as secrets, subscription URLs, provider credentials, or client configuration into this repository.
- Do not publish a public subscription endpoint without authentication or a deliberate access policy.
- Do not expose SSH password authentication to the public internet when key-based SSH is available.
- Restrict firewall rules to the assigned ports; retain a recovery path before changing SSH/firewall settings.
- Keep a local encrypted backup of required server configuration. The candidate advertises no backups.
- Start with one authorized test device. Verify handshake, DNS behavior, IPv4/IPv6 routing, reconnect, and disconnect before calling it working.
- Do not claim anonymity or guaranteed uptime. Free runtime and shared capacity can stop or change the instance.

## Next concrete step

The user must sign in to the provider and review its live policy and account/runtime flow. This step cannot be performed from the repository integration. Do not share passwords or tokens in chat. Once the VPS is provisioned, provide only non-secret facts: OS, assigned port numbers/protocols, whether IPv6 is available, and whether SSH key login works. Never send private keys or full client profiles.
