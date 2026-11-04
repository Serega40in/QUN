# QUN consensus and P2P design gate

Status: design proposal only. This document does not implement networking, consensus, token economics, or production security.

## Why networking is not the next safe code change

A peer-to-peer transport only distributes messages. It does not decide which history is canonical. If nodes accept whichever block arrives first, they can permanently disagree or follow an attacker-controlled history. QUN must define deterministic validation and fork choice before connecting nodes to one another.

## Current prototype boundary

The current node is a single-process local development prototype. It has a hash-linked chain, signed Ed25519 transactions, a JSON snapshot, and a local dashboard. It does not have peer discovery, block propagation, a mempool, a validator set, Sybil resistance, fork choice, finality, or a public testnet. The development funding endpoint is not a real token issuance mechanism.

## Required design decisions before P2P

1. **Network identity and protocol version** — chain/network ID, protocol version, message size limits, and incompatible-version behavior.
2. **Canonical encoding** — one unambiguous byte encoding for transactions, blocks, and signed messages. Do not rely on incidental JSON serialization as the long-term consensus encoding.
3. **State transition rules** — deterministic transaction validation, nonce rules, fee policy (if any), overflow behavior, and transaction ordering.
4. **Block validity** — parent reference, height, timestamp constraints, transaction limits, state root, and signature rules.
5. **Consensus and fork choice** — select a specific consensus family before implementation. Proof-of-work, proof-of-stake/BFT, and a permissioned validator set have materially different security assumptions. Do not invent a hybrid without a threat model.
6. **Peer discovery and connection limits** — bootstrap peers, inbound/outbound limits, timeouts, rate limits, message framing, and malformed-message handling.
7. **Synchronization** — header-first validation, bounded block downloads, reorg handling, checkpoints only if their trust assumptions are explicit, and recovery from corrupt local state.
8. **Persistence and crash safety** — transactional state updates, atomic recovery, schema/version migration, and tests for interrupted writes.
9. **Abuse resistance** — Sybil/eclipse attacks, spam, oversized payloads, peer bans/backoff, replay, and resource-exhaustion testing.
10. **Observability** — peer count, sync state, current tip, rejected-message counters, and a clear indication when a node is not synchronized.

## Proposed implementation sequence

- [ ] Extract deterministic chain/state transition logic into a library API independent of HTTP.
- [ ] Add API tests proving rejected signed transactions do not change ledger, chain, or persisted snapshot.
- [ ] Replace consensus-sensitive JSON hashing with a versioned canonical encoding and compatibility tests.
- [ ] Specify and review the threat model and select one consensus design.
- [ ] Implement deterministic fork-choice and reorganization tests with competing valid/invalid histories.
- [ ] Add a bounded local multi-node integration harness on loopback; test partition, delayed messages, duplicate messages, restart, and conflicting tips.
- [ ] Only after those tests pass, define public devnet configuration and bootstrap peers.

## Security acceptance criteria

- Every node independently validates every transaction and block; peer claims are never trusted as proof of validity.
- Identical valid inputs produce identical state roots and block identifiers on all supported platforms.
- Invalid signatures, wrong nonces, insufficient balances, replayed transactions, malformed encodings, and invalid parent links are rejected deterministically.
- Rejected requests leave the chain, ledger, and persisted state unchanged.
- Sync and message processing have explicit size, time, and resource limits.
- Local test funding and unauthenticated development routes are unavailable in any public-node profile.
- No production-readiness or decentralization claim is made until independent nodes can synchronize and converge under the documented threat model.

## Explicit non-goals for this stage

No real-value coin, exchange listing, token reward, mining profitability claim, public API exposure, wallet key export, or paid infrastructure is introduced by this design.