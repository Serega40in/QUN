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
- `POST /dev/mine` — legacy unsigned demo route. It does not authenticate sender identity; local tests only.
- `POST /dev/mine-signed` — verify Ed25519 signatures and sender/public-key match, apply ledger checks, then append a block that stores both the transactions and signatures.

Example local test transfer (first enable test funding and fund `alice-demo` using the dashboard):

```sh
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/chain
curl http://127.0.0.1:8787/accounts
curl -X POST http://127.0.0.1:8787/dev/mine \
  -H 'content-type: application/json' \
  -d '{"transactions":[{"from":"alice-demo","to":"bob-demo","amount":25,"nonce":1}]}'
```

## Signed transaction format

`POST /dev/mine-signed` expects this JSON shape:

```json
{
  "signed_transactions": [
    {
      "transaction": {
        "from": "<lowercase-hex Ed25519 public key>",
        "to": "recipient-demo",
        "amount": 25,
        "nonce": 1
      },
      "public_key": "<same 32-byte public key encoded as lowercase hex>",
      "signature": "<64-byte Ed25519 signature encoded as lowercase hex>"
    }
  ]
}
```

The signature covers a deterministic, domain-separated `QUN_TX_V1` payload containing sender, recipient, amount, and nonce. The sender must equal the public key hex. Signed blocks use a `QUN_BLOCK_V2` hash payload that includes signatures. The `Chain::validate` path re-verifies signatures on signed blocks after loading persisted data. Fund the sender's public-key address only through the local development funding mechanism when testing.

## Current implementation and limitations

- The node persists a JSON snapshot containing the hash-linked chain and demo ledger, validates chain links and signed transactions when loading, and keeps legacy snapshots readable.
- The ledger validates non-empty addresses, positive amounts, no self-transfer, sequential nonces, sufficient sender balance, and balance overflow.
- `/dev/mine-signed` verifies signatures before ledger mutation, then persists the ledger update and signed block together. A rejected transfer should not mutate the saved snapshot.
- **The legacy `/dev/mine` endpoint still accepts unsigned demo transactions.** Do not use it as a secure transaction path; the dashboard currently uses this route and has not yet been migrated to browser-side signing.
- The HTTP API has no authentication. Keep the node on localhost; do not expose it to the internet or real assets.
- There is no peer-to-peer networking, distributed consensus, validator set, or finality. A single local process appends blocks.
- `/dev/fund` is a test-only balance setter, not a consensus-backed genesis allocation. Never enable it on a public node.
- JSON snapshot replacement is atomic at the file level but is not a transactional database with crash-proof guarantees.
- The GitHub Pages explorer cannot safely call a user's localhost node from a remote browser without deliberate API/CORS design. Do not add permissive CORS or public binding casually.

This is an engineering prototype, not a production blockchain or public testnet. No real assets, security guarantees, or decentralization claims are supported yet.
