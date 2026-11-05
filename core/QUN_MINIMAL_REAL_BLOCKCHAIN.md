# QUN Minimal Real Blockchain — Release Contract

Status: engineering target for the first public testnet. This document does not claim mainnet readiness.

## Product objective

Ship the smallest complete blockchain that an independent developer can run, inspect, connect a wallet to, and build a contract on. Prefer fewer well-tested features over a broad but fragile feature list.

## Initial technology decisions to validate

- Node implementation: Rust.
- Transaction signatures: Ed25519 for the initial native account model, unless the smart-contract VM choice requires a different standard.
- Consensus: one explicit mechanism only for the first network. PoW is the current candidate because the project wants open mining; no hybrid PoW+staking in v1.
- Smart contracts: prioritize EVM compatibility and Solidity tooling as the default candidate because it gives developers an established language, wallet conventions, libraries, and deployment workflow. Before locking this in, run a small integration spike using a maintained Rust EVM implementation and measure execution, determinism, dependency health, and security surface. Do not write a new VM or language for v1.
- RPC: versioned, documented HTTP JSON-RPC; WebSocket events can follow after the minimal stable interface.
- Developer experience: one-command local devnet, CLI, sample contract, deterministic tests, explorer, and copy-pasteable quickstart.

## The minimum release must have

1. **Consensus:** every node independently verifies block linkage and consensus work; deterministic fork choice uses cumulative work; difficulty and timestamp rules are explicit and tested.
2. **Ledger:** authenticated transactions, nonce/replay protection, fee accounting, bounded integer arithmetic, deterministic state transitions, and no public admin mint.
3. **Persistence:** crash-safe writes, versioned data format, startup validation, recovery tests, and bounded resource use.
4. **Networking:** peers exchange bounded messages, validate all untrusted input, sync from a trusted network/genesis configuration, and recover from disconnects and competing blocks.
5. **Contracts:** deterministic VM execution, gas/metering, state isolation, revert semantics, contract deployment/calls, events, and resource limits. No filesystem/network access from contracts unless explicitly designed and metered.
6. **Interfaces:** stable RPC, CLI, SDK, wallet transaction flow, and a minimal block/transaction explorer.
7. **Security:** fuzzing of parsers, property/invariant tests, reproducible builds where feasible, dependency review, threat model, external review before real-value use.
8. **Operations:** pinned genesis/network parameters, protocol versioning, release binaries, node configuration, monitoring basics, backup/restore and upgrade guidance.

## Explicitly out of scope for v1

- Multiple consensus systems or hybrid consensus.
- A new programming language or virtual machine.
- Unverified “useful compute” being allowed to mint consensus rewards.
- Staking rewards before a separately specified consensus design.
- Bridges, cross-chain messaging, complex DeFi primitives, governance token voting, and exchange integration.
- Mainnet launch or real-value claims before independent review.

## Acceptance gates

### Gate A — Local deterministic chain
A developer starts a local network, mines/produces blocks according to the selected consensus, submits signed transactions, restarts the node, and gets the same validated chain and state.

### Gate B — Independent nodes
At least two separately launched nodes exchange blocks, reject invalid work and invalid transactions, recover after a disconnect, and converge on the chain with the greatest valid cumulative work under the protocol rules.

### Gate C — Smart contract
A sample Solidity contract can be compiled with standard tools, deployed through the documented RPC, called by a wallet or CLI, and verified by tests for gas limits, revert behavior, deterministic output, and restart persistence.

### Gate D — Testnet
Public testnet genesis and parameters are pinned; test coins have no claimed market value; operators can run nodes using documented instructions; crash, malformed-input, replay, and reorganization tests pass.

### Gate E — Real-value decision
No mainnet or real-money use until independent consensus, VM, cryptographic, storage, and economic reviews have been completed and findings addressed.

## Current gap

The repository has canonical transaction/block encoding, opt-in canonical signatures, ledger replay, an integrity-checked snapshot, local canonical-store code, and isolated PoW header primitives. It does not yet have integrated PoW consensus, difficulty adjustment, cumulative-work fork choice, P2P synchronization, protocol-level issuance, a contract VM, stable public RPC for the new chain, or a production release process. The legacy demo chain must not be mistaken for the canonical chain.

## Working rule

For each feature: define the protocol rule, implement the smallest version, add adversarial tests, run CI, document the boundary, then integrate. Do not mark a feature complete based only on code being committed.
