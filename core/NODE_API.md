# QUN Core local HTTP node (development prototype)

This Rust binary exposes a local HTTP API around the hash-linked QUN chain and its persisted demo ledger. It is intended for local engineering and UI integration experiments only.

## Run

From the repository root:

```sh
cd core
cargo run --bin node
```

Open `http://127.0.0.1:8787/` for the interactive local explorer. It displays blocks and test balances, creates an ephemeral Ed25519 key in the browser, and submits transfers through the signed transaction endpoint. The private key remains in tab memory and is lost when the tab is closed or reloaded; this is a disposable demo key, not a production wallet.

The node binds to `127.0.0.1:8787` by default and stores the snapshot in `core/data/qun-chain.json` when launched from the repository's `core` directory. Override these with `QUN_BIND` and `QUN_DATA_FILE`. The API has no authentication: do not expose it to a public interface or the internet.

For local testing only, enable demo funding with `QUN_ENABLE_DEV_FUNDING=true`. The legacy unsigned `/dev/mine` route is off unless `QUN_ENABLE_UNSIGNED_DEV_MINE=true`. The whole API is unauthenticated (including `/dev/mine-signed`, which lets any caller append blocks), so the node refuses a non-loopback `QUN_BIND` unless `QUN_ALLOW_NON_LOOPBACK=true` is set, and it never starts with a development flag enabled on a non-loopback address.

## Endpoints

- `GET /` — local interactive dashboard.
- `GET /health` — status, `chain_id`, height, block count, mode, enabled development routes, and safety warnings.
- `GET /chain` — current chain snapshot.
- `GET /blocks/{index}` — one block by height.
- `GET /accounts` — current test balances and account nonces.
- `POST /dev/fund` — set a test balance; disabled unless `QUN_ENABLE_DEV_FUNDING=true`.
- `POST /dev/mine` — legacy unsigned demo route; returns `403` unless `QUN_ENABLE_UNSIGNED_DEV_MINE=true`. It does not authenticate sender identity; local tests only.
- `POST /dev/mine-signed` — verify Ed25519 signatures and sender/public-key match, apply ledger checks, then append a block that stores both the transactions and signatures.

Example unsigned legacy/demo transfer (requires `QUN_ENABLE_UNSIGNED_DEV_MINE=true`; not recommended, use the browser dashboard for signed transfers):

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

The signature covers the canonical binary `QUN_TX_V2` payload:

```
str("QUN_TX_V2") || str(chain_id) || str(from) || str(to) || u64(amount) || u64(nonce)
```

where `u64(x)` is 8 bytes big-endian and `str(s)` is `u64(len(utf8(s)))` followed by the UTF-8 bytes. The chain ID (`qun-devnet-1`, also reported by `/health`) is part of every signature, so a transaction signed for one QUN network is rejected on another. Test vector for `{from:"aa", to:"bob", amount:25, nonce:1}` on `qun-devnet-1`:

```
000000000000000951554e5f54585f5632000000000000000c71756e2d6465766e65742d3100000000000000026161
0000000000000003626f6200000000000000190000000000000001
```

The dashboard builds the same bytes in JavaScript before signing. `public_key` must be exactly 64 and `signature` exactly 128 **lowercase** hex characters (no `0x`, no uppercase); any other spelling is rejected so one signature cannot appear in several forms with different block hashes. The sender must equal the public key hex. Block hashes use the same encoding with the `QUN_BLOCK_V3` / `QUN_SIGNED_BLOCK_V3` domains and the chain ID; signed blocks include the public keys and signatures.

**Breaking change:** snapshots written before `QUN_TX_V2` / `QUN_BLOCK_V3` fail validation on load. For this development prototype, delete the old `QUN_DATA_FILE` (default `data/qun-chain.json`) and start a fresh local chain. The `Chain::validate` path re-verifies signatures on signed blocks after loading persisted data. Fund the sender's public-key address only through the local development funding mechanism when testing.

## Current implementation and limitations

- The node persists a JSON snapshot containing the hash-linked chain and demo ledger, validates chain links and signed transactions when loading, and keeps legacy snapshots readable.
- The ledger validates non-empty addresses, positive amounts, no self-transfer, sequential nonces, sufficient sender balance, and balance overflow.
- `/dev/mine-signed` verifies signatures before ledger mutation, then persists the ledger update and signed block together. A rejected transfer should not mutate the saved snapshot.
- The legacy `/dev/mine` endpoint accepts unsigned demo transactions only when `QUN_ENABLE_UNSIGNED_DEV_MINE=true` on a loopback address; by default it returns `403`. The dashboard uses browser-side Ed25519 signing and `/dev/mine-signed`.
- The ledger in the snapshot is stored next to the chain and is not yet rebuilt by replaying blocks on load (Gate 2).
- The HTTP API has no authentication. Keep the node on localhost; do not expose it to the internet or real assets.
- There is no peer-to-peer networking, distributed consensus, validator set, or finality. A single local process appends blocks.
- `/dev/fund` is a test-only balance setter, not a consensus-backed genesis allocation. Never enable it on a public node.
- JSON snapshot replacement is atomic at the file level but is not a transactional database with crash-proof guarantees.
- The GitHub Pages explorer cannot safely call a user's localhost node from a remote browser without deliberate API/CORS design. Do not add permissive CORS or public binding casually.

This is an engineering prototype, not a production blockchain or public testnet. No real assets, security guarantees, or decentralization claims are supported yet.
