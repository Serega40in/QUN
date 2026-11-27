# QUN Core: testnet release gates

**Status: engineering checklist, not a declaration of a live network.**

QUN Core is the intended sovereign-chain implementation. A local chain prototype or a passing unit-test suite is not, by itself, a public blockchain. Do not advertise mainnet readiness or accept real-value deposits until every applicable gate below has evidence attached.

## Current release sequence

1. **Reproducible build:** CI formats, lints, and tests the Rust crate from a clean checkout.
2. **Transaction and state correctness:** canonical transaction bytes, signature verification, network/chain ID binding, nonce/replay protection, checked balance arithmetic, deterministic execution, and explicit genesis/issuance rules.
3. **Durable storage:** crash-safe persistence, replay from genesis, state-vs-replay comparison, schema versioning, and recovery tests.
4. **Node API and networking:** bounded request sizes, validation before relay, peer authentication/limits, sync protocol, and rate limiting.
5. **Consensus:** documented threat model, validator admission, fork choice/finality, and adversarial multi-node tests. A hash-linked chain or experimental proof-of-work nonce search is not consensus.
6. **Private multi-node devnet:** independent processes on separate data directories; verify block production, restart/rejoin, duplicate/replay rejection, network partition behavior, and identical state roots.
7. **Public testnet:** reproducible node binaries, immutable genesis configuration, public RPC/explorer, monitoring, faucet limits, incident response, and documented reset policy.
8. **Wallet integration:** wallet reads balances and transaction status from the node; signs locally; verifies chain ID and recipient; handles pending/confirmed/failed states; tests duplicate submissions and insufficient funds.
9. **Security review:** dependency audit, threat-model review, external smart-contract/protocol review, and a documented response process.
10. **Mainnet decision:** only after testnet soak, independent node operators, reproducible release artifacts, reviewed tokenomics, and explicit launch approval.

## TON and QUN sovereign chain are separate

TON Connect and TON contracts provide a separate TON integration path. They do not automatically make TON transactions transactions on QUN Core. Do not bridge assets or present the two ledgers as interchangeable until a separately reviewed bridge design, replay protection, supply accounting, and recovery process exist.

## Current implementation note (2026-11-27)

The Rust core now exposes an **experimental deterministic chain-selection primitive**: it validates both candidate chains, rejects differing configured network IDs, prefers the greater height, and uses the lexicographically smaller tip hash as a deterministic equal-height tie-break. Unit tests cover those rules. This is only a deterministic selection rule for a future sync prototype; it is **not** a secure consensus algorithm, does not authenticate peers, does not prove a chain's state transitions are valid against a common immutable genesis, and provides no finality or Sybil resistance. Do not connect it to automatic live-network reorganization until the genesis/state replay format and consensus threat model are implemented and reviewed.

## Evidence required before marking a gate complete

For each gate, attach the CI run or test report, exact commit SHA, configuration/genesis hash where relevant, and the commands used. Do not infer success from a workflow being configured; inspect its completed run. Never commit seed phrases, private keys, funded keys, or production secrets.

## First local verification

From the repository root:

```sh
cd core
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
```

A failure is a real blocker to fix, not a reason to weaken the gate without an explanation.
