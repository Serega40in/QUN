# QUN Core local HTTP node (development prototype)

This binary exposes a small HTTP API around the existing hash-linked Rust chain. It is intended for local engineering and UI integration experiments only.

## Run

From the repository root:

```sh
cd core
cargo run --bin node
```

Open `http://127.0.0.1:8787/` in your browser for the local interactive explorer. It displays the chain and lets you append demo blocks. The node binds to `127.0.0.1:8787` by default and stores the chain in `core/data/qun-chain.json` (relative to the working directory). Override these with `QUN_BIND` and `QUN_DATA_FILE` if needed. Do not bind to a public interface: the API has no authentication.

## Endpoints

- `GET /` — local interactive dashboard, served by the same node (no cross-origin setup needed).\n- `GET /health` — status, height, block count and limitations.
- `GET /chain` — complete local chain snapshot.
- `GET /blocks/{index}` — one block by height.
- `POST /dev/mine` — append a development block and persist the chain.

Example:

```sh
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/chain
curl -X POST http://127.0.0.1:8787/dev/mine \
  -H 'content-type: application/json' \
  -d '{"transactions":[{"from":"alice-demo","to":"bob-demo","amount":25,"nonce":1}]}'
```

## Important limitations

- Transactions are plain data, not signed or authorized.
- The library now contains a deterministic in-memory `LedgerState` with balance/nonce validation and unit tests, but this ledger is not yet wired into block validation or persisted by the HTTP node. The dashboard's demo block endpoint still accepts unauthenticated demo transactions.
- There is no peer-to-peer networking, consensus, validator set, or finality.
- `/dev/mine` accepts demo transactions without economic validation and must not be exposed to the public internet.
- The chain file is an atomic JSON snapshot, not a database with crash-proof transactional semantics. Startup validates its hash links before serving.
- The current GitHub Pages explorer cannot directly call a user's localhost API from a remote browser without deliberate API/CORS integration. Do not add permissive CORS or public binding casually.

This is an engineering milestone, not a production blockchain or testnet. Never use real funds or claim decentralization/security guarantees.
