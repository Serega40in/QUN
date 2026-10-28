# QUN VPN — Cloudflare and existing infrastructure decision

Status: discovery only. No Cloudflare account or zone was inspected, no deployment was made, and no billable resource was created.

## What we have verified

- The GitHub repository `Serega40in/QUN` is accessible and the existing VPN runbook lives at `docs/vpn/wireguard-runbook.md`.
- The connected Supabase organization has an active project named `QUN` in `eu-central-1`. Its Edge Functions include existing QUN services, but none is a WireGuard VPN server.
- The available connected-app tools do not currently expose Cloudflare account/Workers management. This does not prove that the user has no Cloudflare account; it means we cannot inspect it from this session.

## Technical decision

Use WireGuard on a Linux host as the data plane if/when an authorized host is available. Cloudflare Workers and Pages can serve an HTTPS website, documentation, or a small control/status API, but they are not a general-purpose UDP WireGuard endpoint and must not be presented as a WireGuard VPN server.

Cloudflare Tunnel is useful for exposing selected private HTTP/TCP services through an outbound connector; it is not, by itself, a drop-in public WireGuard UDP endpoint. Cloudflare WARP / Zero Trust private networking is a separate possible design, requiring account-side setup and validation of current plan limits.

## Zero-cost discovery sequence

1. Inspect the user's existing Cloudflare dashboard manually; do not paste API tokens, account secrets, private keys, or client profiles into chat or GitHub.
2. Record whether an account/zone already exists, whether Workers/Pages are enabled, and whether any existing Linux host or tunnel connector is already running.
3. Do not create a new Worker, tunnel, DNS record, server, or paid resource until the existing state and cost implications are clear.
4. If no authorized Linux host exists, compare (a) Cloudflare WARP/Zero Trust private networking within current account limits and (b) a separately approved WireGuard host. Do not promise a full consumer VPN from Workers alone.
5. Keep the first QUN deployment private and limited to authorized devices. Begin with narrow routes; do not force all internet traffic through an untested tunnel.

## Secrets and data boundary

- Never store WireGuard private keys, full client profiles, QR codes, provider tokens, or private endpoint configuration in GitHub.
- Supabase may later hold non-secret inventory/status metadata under strict authorization, but is not the VPN packet relay. Do not add peer keys or credentials to existing public-facing Edge Functions.
- No database schema, Edge Function, Cloudflare resource, DNS record, or live network was changed as part of this discovery.
