# QUN Core development node API

This executable is an integration step for local wallet development. It is **not** a production node: it runs one process, keeps chain and ledger in memory, creates a block for each accepted signed transaction, and has no peer networking or consensus.

## Run

From the repository root:

```sh
cd core
cargo run --bin qun-node
```

By default it binds to `127.0.0.1:8787`. Keep it on loopback; do not expose this prototype to the public internet.

Optional development-only genesis allocations can be supplied before startup:

```sh
QUN_DEV_GENESIS_BALANCES='{"<lowercase-hex-ed25519-public-key>":100000}' cargo run --bin qun-node
```

This configuration is intentionally operator-controlled and is not a consensus-committed genesis specification. Do not use it to imply production token issuance.

## Endpoints

- `GET /health` — service mode and current height; response explicitly warns that consensus and persistence are absent.
- `GET /chain` — current in-memory chain.
- `GET /balance/{address}` — current balance and account nonce.
- `POST /transactions` — submit a JSON `SignedTransaction` object. The node verifies Ed25519 ownership/signature, validates nonce and balances against a cloned ledger state, and only commits the new ledger after block append succeeds.

The signing payload is currently the existing `QUN_TX_V1` format. A protocol upgrade must add an explicit network/chain ID to the signed bytes before multi-network use. Wallets should not use this prototype with valuable funds.

## Required next steps before a devnet

1. Add durable, crash-safe storage and replay verification.
2. Define immutable genesis configuration and protocol/network ID.
3. Add transaction size limits, request timeouts, rate limits, and API error tests.
4. Implement peer protocol and a reviewed consensus/finality design.
5. Test independent nodes, restarts, duplicate submissions, forks, and partitions.
6. Have the wallet sign locally and verify network identity before sending.
