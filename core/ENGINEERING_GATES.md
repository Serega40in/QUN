# QUN Core — engineering gates toward a real network

**Status:** planning and local prototype. This document is not a claim that the listed capabilities already exist.

## Current verified scope

The current Rust crate models blocks and transactions, hashes a fixed serialized block payload with SHA-256, links blocks by previous hash, and checks chain integrity. Its transaction fields are plain strings and integers. A valid block hash proves only that the data matches that hash; it does not prove authorization, ownership, consensus, or economic validity.

The separate `qun-core-01` repository contains a local Hardhat ERC-20 token prototype. That token is not the native coin of the Rust chain. The two projects must not be presented as one deployed network.

## Release gates

### Gate 0 — reproducible baseline
- [ ] Rust formatting, Clippy and tests pass in CI.
- [ ] Build instructions work from a clean checkout.
- [ ] CI results are visible and reproducible.
- [ ] No production secrets, seed phrases or funded private keys are committed.

### Gate 1 — transaction authorization and deterministic state
- [ ] Define a versioned, canonical transaction encoding; do not rely on unspecified serialization behavior for consensus-critical bytes.
- [ ] Use a reviewed signature scheme and well-maintained crate for transaction signatures.
- [ ] Derive account identifiers from public keys with an explicitly versioned address format.
- [ ] Validate signature, chain/network ID, nonce, amount, recipient, and replay protection before state changes.
- [ ] Use checked arithmetic and explicit rules for fees, issuance, and balances.
- [ ] Add negative tests for invalid signatures, replayed transactions, wrong chain ID, stale/future nonce, insufficient funds, overflow, and malformed inputs.
- [ ] Define genesis allocations and issuance rules as immutable, reviewable configuration.

### Gate 2 — state persistence and recovery
- [ ] Define a deterministic state transition function.
- [ ] Persist blocks and state with crash-safe writes and schema/version migration.
- [ ] Rebuild state by replaying blocks and verify replay matches the stored state root.
- [ ] Test restart, corrupted storage, duplicate blocks and interrupted writes.
- [ ] Bound transaction and block sizes to prevent resource-exhaustion attacks.

### Gate 3 — node protocol
- [ ] Specify peer discovery, peer identity, message framing, protocol versioning and timeouts.
- [ ] Validate every peer-supplied object before storing or relaying it.
- [ ] Add rate limits, bounded queues, connection limits and protection against malformed-message floods.
- [ ] Implement deterministic block synchronization and recovery from an out-of-date node.
- [ ] Test partitions, peer churn, invalid peers and inconsistent histories.

### Gate 4 — consensus (do not improvise)
- [ ] Choose and document a consensus protocol based on a threat model, validator model, network assumptions and target finality.
- [ ] State the fault assumptions and validator/admission rules explicitly.
- [ ] Prevent conflicting histories from both being accepted as final under the stated assumptions.
- [ ] Add adversarial multi-node tests, partition tests and restart/rejoin tests.
- [ ] Do not describe a hash-linked chain as a decentralized or Byzantine-fault-tolerant network until those properties are demonstrated.

### Gate 5 — public testnet
- [ ] Reproducible node builds and pinned dependencies.
- [ ] Public protocol specification, genesis parameters, RPC documentation and version policy.
- [ ] Multiple independently operated nodes; no single operator controls every validator.
- [ ] Metrics, logs, health checks, backups, incident response and upgrade/recovery procedures.
- [ ] Load, fuzz, property-based and adversarial tests with published results.
- [ ] Explorer and wallet must clearly identify testnet assets as having no promised monetary value.

### Gate 6 — mainnet readiness
- [ ] Independent protocol and implementation security review, including remediation verification.
- [ ] Explicit token issuance, fees, validator incentives, governance and upgrade policy.
- [ ] Economic attack analysis and simulations; no claim that market price cannot fall.
- [ ] Legal review for relevant jurisdictions before public sale, custody, exchange listing or real-value use.
- [ ] A documented go/no-go decision signed off by the responsible maintainers.

## Benchmark policy

Do not claim superiority over Bitcoin or Ethereum from code inspection alone. Publish reproducible measurements for throughput, finality, node hardware, network conditions, storage growth, validator concentration, attack assumptions and operational cost. Compare equivalent workloads and state the limitations.

## AI-assisted audit policy

Ask multiple models to identify bugs, attack paths, missing invariants and counterexamples. Give each model the same commit SHA, specification and test results; keep model outputs separate before reconciliation. Treat model findings as hypotheses until reproduced or disproved. Never prompt models to assert that QUN is secure, competitive, or guaranteed to appreciate. Publish only evidence-backed conclusions and known limitations.

## Immediate next actions

1. Run the new Rust CI workflow and fix any baseline failures.
2. Review the current crate and tests before changing consensus-critical code.
3. Write a transaction/state specification and adversarial test matrix.
4. Implement each gate on a separate branch with CI evidence.
5. Keep mainnet deployment and any real-money use blocked until independent review.
