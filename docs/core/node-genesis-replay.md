# Configured genesis replay (development only)

The local node can optionally reconstruct its ledger from a genesis allocation file and the signed chain history instead of trusting balances cached in the JSON snapshot.

## Example

The repository includes `core/genesis.testnet.example.json`. It is a disposable local-testnet example, not a mainnet allocation plan and not a real token supply.

Run the node from the repository root with:

```sh
QUN_GENESIS_FILE=core/genesis.testnet.example.json cargo run --manifest-path core/Cargo.toml --bin node
```

On Windows PowerShell:

```powershell
$env:QUN_GENESIS_FILE = "core/genesis.testnet.example.json"
cargo run --manifest-path core/Cargo.toml --bin node
```

When `QUN_GENESIS_FILE` is set, startup validates the config and chain, then rebuilds balances and nonces from configured allocations and signed transactions. A history containing unsigned legacy transactions fails startup rather than being silently trusted. The cached ledger is ignored in this mode.

## Important limitations

- The genesis config is still supplied out-of-band; its hash is not yet committed into the canonical genesis block/header. Nodes could therefore be configured with different allocations. Do not use this as a production network identity mechanism.
- `/dev/fund` is an out-of-chain development convenience. It is not an issuance transaction and its balance will not survive a restart in configured-replay mode unless represented by a future protocol-defined issuance mechanism.
- The current block format still permits legacy unsigned blocks for compatibility outside configured replay. Production protocol must remove that ambiguity in a versioned migration.
- This does not implement P2P, peer authentication, consensus/fork choice, a production mempool, secure wallet key storage, or real-asset support.

Never expose this unauthenticated local API publicly or use real funds. This is a step toward deterministic state recovery, not mainnet readiness.
