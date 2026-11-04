# QUN Core local HTTP node (development prototype)

This Rust binary exposes a local HTTP API around the hash-linked QUN chain and its persisted demo ledger. It is intended for local engineering and UI integration experiments only.

## Run

From the repository root:

```sh
cd core
cargo run --bin node
```

Open `http://127.0.0.1:8787/` for the interactive local explorer. It displays blocks and test balances, lets you issue a development-only test balance when explicitly enabled, and submits demo transfers to the local ledger.

The node binds to `127.0.0.1:8787` by default and stores the snapshot in `core/data/qun-chain.json` when launched from the repository's `core` directory. Override these with `QUN_BIND` and `QUN_DATA_FILE`. The API has no authentication: do not expose it to a public interface or the internet.

For local testing only, enable demo funding with `QUN_ENABLE_DEV_FUNDING=true`. Keep this disabled outside local development.

## Endpoints

- `GET /` — local interactive dashboard.
- `GET /health` — status, height, block count, mode, and safety warnings.
- `GET /chain` — current chain snapshot.
- `GET /blocks/{index}` — one block by height.
- `GET /accounts` — current test balances and account nonces.
- `POST /dev/fund` — set a test balance; disabled unless `QUN_ENABLE_DEV_FUNDING=true`.
- `POST /dev/mine` — append a block after applying the submitted demo transactions to the persisted in-memory ledger state.

Example local test transfer (first enable test funding and fund `alice-demo` using the dashboard):

```sh
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/chain
curl http://127.0.0.1:8787/accounts
curl -X POST http://127.0.0.1:8787/dev/mine \
  -H 'content-type: application/json' \
  -d '{"transactions":[{"from":"alice-demo","to":"bob-demo","amount":25,"nonce":1}]}'
```

## Current implementation and limitations

- The node persists a JSON snapshot containing both the hash-linked chain and demo ledger, and validates chain hash links when loading.
- The ledger validates non-empty addresses, positive amounts, no self-transfer, sequential nonces, sufficient sender balance, and balance overflow.
- A successful demo transfer updates the ledger and appends the corresponding block; a rejected transfer should not mutate the saved snapshot.
- **Sender identity is not cryptographically authenticated.** Anyone able to reach this unauthenticated API can claim another sender address. Never use this prototype for real assets.
- There is no peer-to-peer networking, distributed consensus, validator set, or finality. A single local process appends blocks.
- `/dev/fund` is a test-only balance setter, not a consensus-backed genesis allocation. Never enable it on a public node.
- JSON snapshot replacement is atomic at the file level but is not a transactional database with crash-proof guarantees.
- The GitHub Pages explorer cannot safely call a user's localhost node from a remote browser without deliberate API/CORS design. Do not add permissive CORS or public binding casually.

This is an engineering prototype, not a production blockchain or public testnet. No real assets, security guarantees, or decentralization claims are supported yet.
