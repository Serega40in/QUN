# QUN Core local development node

The canonical development node is `core/src/bin/node.rs` (binary name: `node`). It includes a local explorer, a JSON snapshot file, signed Ed25519 transaction verification, state replay/validation on startup, and development-only funding. It is **not** a production blockchain node: peer-to-peer transport/discovery, secure peer authentication, consensus/finality, immutable production genesis, and real-asset safety are not implemented. A fixed `qun-local-dev-v0` network label is only a development guard, not a cryptographic chain ID.

## Run

From the repository root:

```sh
cd core
cargo run --bin node
```

By default it binds to `127.0.0.1:8787`. Keep it on loopback; the prototype has no authentication and must not be exposed to the public internet.

The local state file defaults to `core/data/qun-chain.json` when run from the repository root. Override the location with `QUN_DATA_FILE=/path/to/state.json`. Override the bind address with `QUN_BIND=127.0.0.1:8787`.

## Endpoints

- `GET /` — local QUN Core explorer.
- `GET /health` — node status and height.
- `GET /chain` — chain data.
- `GET /accounts` — balances and account nonces.
- `GET /blocks/{index}` — details for a block.
- `GET /peer/export` — export the local chain and development genesis allocations as a JSON bundle.
- `POST /peer/sync` — manually import a JSON bundle from `/peer/export`; validates chain hashes, signed transactions, state replay, network label, and exact matching genesis allocations before considering a deterministic chain choice. Only signed transaction blocks are accepted from peers.
- `POST /dev/mine-signed` — validate and append signed Ed25519 transactions, persist the candidate state, then commit it in memory.
- `POST /dev/mine` — unsigned demo transactions only; sender identity is not cryptographically authenticated.
- `POST /dev/fund` — development-only test balance allocation, disabled by default. Enable explicitly with `QUN_ENABLE_DEV_FUNDING=true` only for local testing.

To try manual two-node sync, run two node processes on separate ports and data files, enable test funding on both, fund the same address with the same amount before either node creates a block, then copy the JSON from one node's `/peer/export` into the other's `POST /peer/sync`. The sync endpoint is unauthenticated and manual: keep both nodes bound to loopback. It prefers a longer valid chain and uses a deterministic equal-height tie-break; this is **not consensus or finality**, and nodes do not discover peers or sync automatically.

The browser explorer creates an Ed25519 key in tab memory for test transactions. It is not a secure wallet and the key is lost when the tab closes or reloads. Do not use valuable funds.

## Verified capabilities and remaining work

The existing integration tests cover signed transfers, rejection of replayed transactions, persistence across node restart, and rejection of tampered saved chains. The CI gate must pass formatting, Clippy, and all tests before merging.

Before calling this a devnet, the project still needs a signed/immutable genesis manifest and chain ID included in transaction signatures, peer discovery and authenticated transport, a reviewed consensus/finality design, adversarial independent multi-node tests (including forks and partitions), API authentication/rate limits, and a security review. TON integration is a separate network path and does not make this sovereign QUN chain live.
