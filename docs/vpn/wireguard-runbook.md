# QUN VPN — WireGuard implementation runbook

Status: design/runbook on an isolated branch. A server has not been provisioned and no VPN is claimed to be operational.

## Target
A small private network for explicitly authorized QUN devices, with Windows and Android clients. WireGuard is the default for a private VPN. Proxy protocols and HAPP compatibility are a separate design decision.

## Safety rules
- Do not commit private keys, client configs, QR codes, passwords, real endpoint details or provider tokens.
- Generate a unique key pair per device; server retains only the peer public key and permitted routes.
- Never expose an admin panel to the public internet.
- Firewall defaults to deny; allow only necessary VPN and explicitly approved internal services.
- No paid server or infrastructure is created without explicit approval.
- A VPN protects traffic to the VPN endpoint; do not promise anonymity.

## Deployment sequence
1. [ ] Inventory existing infrastructure and choose an authorized host; document OS, public reachability, port and firewall access without publishing secrets.
2. [ ] Confirm the host can safely run WireGuard and persist configuration across reboot.
3. [ ] Configure IPv4/IPv6 forwarding only if required; define a narrow VPN subnet and AllowedIPs; apply least-privilege firewall rules.
4. [ ] Generate server/client keys on the host or device using WireGuard tooling. Deliver client config securely, never through repository or issue comments.
5. [ ] Import the client profile on Windows and Android; verify handshake, routes, DNS, IPv6 behavior and expected egress.
6. [ ] Revoke a test peer and confirm access stops; document key rotation and device loss procedure.
7. [ ] Back up server configuration securely; test restoration without exposing private material.
8. [ ] Add health checks and a recovery/rollback procedure; record only redacted diagnostics.

## Acceptance criteria
- Windows and Android both establish a verified handshake with the authorized server.
- A revoked peer can no longer access the VPN.
- Firewall and AllowedIPs expose only approved routes.
- DNS/IPv6 leakage behavior is tested and documented.
- Reboot and backup/restore tests pass.
- No paid resources or live network changes without owner approval.
