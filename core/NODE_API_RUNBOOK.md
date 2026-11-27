# QUN Core development node API

This executable is an integration step for local wallet development. It is **not** a production node: it runs one process, stores a local JSON snapshot, and has no peer networking or consensus. On startup it validates the saved chain and replays signed transactions to reconstruct the ledger; it refuses to start if the saved chain or state transitions are invalid.

## Run

From the repository root:

```sh
cd core
cargo run --bin qun-node
```

By default it binds to `127.0.0.1:8787`. Keep it on loopback; do not expose this prototype to the public internet.

The node writes state to `./.qun-node-data.json` in the current working directory. Override this with `QUN_NODE_DATA_FILE=/path/to/state.json`. Accepted transactions are written to a temporary file, synced, and renamed into place before in-memory state is committed. This is a local single-writer snapshot, not replicated or consensus-backed storage.

Optional development-only genesis allocations can be supplied before the first startup:

```sh
QUN_DEV_GENESIS_BALANCES='{"<lowercase-hex-ed25519-public-key>":100000}' cargo run --bin qun-node
```

Once the state file exists, its genesis allocations are authoritative for that local database; changing the environment variable does not rewrite existing state. This configuration is operator-controlled and is not a consensus-committed genesis specification. Do not use it to imply production token issuance.

## Endpoints

- `GET /health` — service mode and current height; response warns that peer networking and consensus are absent.
- `GET /chain` — current chain.
- `GET /balance/{address}` — current balance and account nonce.
- `POST /transactions` — submit a JSON `SignedTransaction` object. The node verifies Ed25519 ownership/signature, validates nonce and balances against a cloned ledger state, builds a candidate block, persists it, and only then commits the candidate chain and ledger in memory.

The signing payload is currently the existing `QUN_TX_V1` format. A protocol upgrade must add an explicit network/chain ID to the signed bytes before multi-network use. Wallets should not use this prototype with valuable funds.

## Required next steps before a devnet

1. Define immutable genesis configuration and protocol/network ID.
2. Add transaction size limits, request timeouts, rate limits, and API error tests.
3. Implement peer protocol and a reviewed consensus/finality design.
4. Test independent nodes, restarts, duplicate submissions, forks, and partitions.
5. Have the wallet sign locally and verify network identity before sending.
6. Review persistence semantics and threat model before treating this as production storage.
