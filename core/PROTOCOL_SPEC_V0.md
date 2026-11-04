# QUN Core Protocol Specification — Draft v0

**Status:** design draft only; not implemented or audited. No real assets should be used.

## 1. Scope and separation

QUN Core in this repository is intended to become a native chain with its own state transition rules and peer-to-peer protocol. The separate `qun-core-01` repository is a local EVM/ERC-20 experiment; it is not the native asset implementation for this Rust chain. Do not merge their claims or tokenomics without an explicit architecture decision.

## 2. Security goals

The protocol must aim to provide:
- deterministic validation of every accepted transaction and block;
- authorization through cryptographic signatures;
- replay protection across accounts, chains and protocol versions;
- explicit, checked state transitions;
- a documented consensus threat model and finality guarantee;
- bounded resource use for untrusted network inputs;
- reproducible node builds and a public test suite.

These are goals, not current guarantees.

## 3. Transaction model (proposal)

A versioned transaction should include:
- protocol version;
- chain/network identifier;
- sender address derived from a public key under a versioned address scheme;
- recipient address;
- amount in the smallest integer denomination;
- nonce;
- fee and fee-policy version;
- signature over a canonical, domain-separated signing payload.

Consensus-critical bytes must use a specified canonical encoding. Do not rely on unspecified map ordering, locale-sensitive formatting, or floating-point values. Validate signatures before applying state changes. Use a maintained cryptographic library rather than a hand-written signature implementation.

## 4. State transition invariants

For each accepted transaction:
1. The transaction encoding and version are supported.
2. The chain ID matches the node's configured network.
3. The signature is valid for the sender and exact signing payload.
4. The nonce is exactly the expected next nonce for the sender.
5. Amount and fee are valid and all arithmetic uses checked operations.
6. The sender has sufficient spendable balance for amount plus fee.
7. The transaction is applied exactly once; any failure leaves state unchanged.
8. Issuance and validator rewards follow explicit, deterministic protocol rules.

For each block:
- parent hash, height, timestamp constraints and protocol version are valid;
- block and transaction size/count limits are enforced;
- all transactions are individually valid and ordered deterministically;
- no transaction is applied twice;
- computed state root and block identifier match the specified encoding;
- consensus authorization is checked according to the selected consensus protocol.

## 5. Account and monetary policy

Before implementation, decide and document:
- genesis allocations and how the genesis file is authenticated;
- smallest denomination and decimal display convention;
- whether supply is capped, inflationary, or governed by another explicit rule;
- fee calculation, fee destination and validator rewards;
- how protocol upgrades can change monetary rules, if at all.

A supply cap alone does not create demand, price stability or a guarantee of appreciation. No market-price guarantee should be made.

## 6. Consensus decision gate

Do not select a consensus algorithm by marketing appeal. Compare candidates against:
- permissionless or permissioned validator model;
- assumed number and fraction of malicious validators;
- network synchrony assumptions;
- safety, liveness and finality guarantees;
- validator admission, exit and slashing rules;
- Sybil resistance and cost of attack;
- hardware and bandwidth requirements;
- recovery and upgrade behavior.

A single-process block list or a set of nodes that all trust one operator is not evidence of decentralized consensus. Publish the threat model before claiming Byzantine fault tolerance or economic security.

## 7. Test requirements

Required before testnet:
- unit tests for valid and invalid signatures, wrong chain IDs, nonce replay, insufficient funds, integer overflow and malformed encodings;
- property-based tests for state-transition invariants;
- fuzzing for all parsers and peer message handlers;
- multi-node tests for forks, partitions, delayed messages, restarts and resynchronization;
- adversarial tests for double-spend attempts and conflicting histories;
- reproducible benchmark methodology and recorded hardware/software versions.

## 8. Claims policy

Every external claim must be classified as:
- **implemented and tested** — evidence and test link available;
- **implemented but not independently reviewed** — local tests only;
- **planned** — not implemented;
- **unknown** — insufficient evidence.

Do not claim parity with Bitcoin or Ethereum, production security, decentralization, audited status, guaranteed returns, or that the coin cannot fall unless the specific claim can be substantiated. Even then, market price cannot be guaranteed.

## 9. Next implementation sequence

1. Establish a clean CI baseline for the existing Rust crate.
2. Add versioned signed transactions and deterministic account/state validation.
3. Add persistent state and replay/recovery tests.
4. Write and review the consensus threat model; then implement a selected protocol.
5. Add P2P networking and multi-node adversarial tests.
6. Deploy a clearly labeled public testnet.
7. Commission an independent review and verify remediation before any mainnet decision.
