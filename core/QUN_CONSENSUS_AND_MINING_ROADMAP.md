# QUN Consensus and Mining Roadmap (proposal)

Status: design proposal only. Nothing in this document activates mining, issuance, staking, or a live network.

## 1. Product principle

QUN should reward measurable contribution while keeping the rules public, deterministic, and independently verifiable. Monetary issuance must be a consensus rule, never a privileged admin action.

## 2. Separate three mechanisms

### A. Chain security and block production

For a Bitcoin-like first public network, evaluate Proof of Work (PoW) as the primary consensus mechanism. Each candidate block must commit to its parent hash, height, network ID, transactions, and a nonce or equivalent work field. Nodes independently verify the target and hash; difficulty adjusts according to a specified rule. Fork choice must be deterministic and documented.

PoW must not be considered implemented until the protocol defines:
- the exact hash algorithm and header bytes;
- target encoding and valid target range;
- genesis parameters and network ID;
- difficulty adjustment and timestamp constraints;
- cumulative-work fork choice and reorganization limits/policy;
- issuance, transaction fees, subsidy schedule, and integer overflow rules;
- denial-of-service limits and independent-node tests.

### B. Useful-work marketplace

Rendering, image processing, AI inference, and other compute tasks should initially be an optional service marketplace, not the consensus mechanism. A task payout is funded by a customer or an explicitly budgeted program; it is not automatically newly minted currency.

A worker's CPU time or an open browser tab is not proof of useful work. Jobs need reproducible outputs, deterministic verification where possible, redundant execution or randomized challenges where appropriate, and explicit dispute handling. Unverifiable workloads must not mint protocol rewards.

### C. Staking and node services

Staking is a separate consensus family, not an extra button that can be safely added to PoW. It requires validator selection, stake accounting, lock and withdrawal rules, finality, slashing evidence, key recovery, and analysis of long-range and nothing-at-stake attacks. Do not activate staking on the PoW chain without a separately reviewed protocol upgrade or a deliberately designed hybrid consensus.

Storage and uptime rewards likewise require challengeable proofs of service and a defined payer. Self-reported disk space or uptime is not sufficient.

## 3. Recommended sequencing

1. Finish canonical encoding, replay, persistence, corruption handling, and CI validation.
2. Build a separate deterministic PoW simulator with no real token issuance.
3. Specify and test header format, target checks, cumulative work, difficulty adjustment, and reorganization behavior.
4. Choose a monetary policy only after attack-cost and miner-accessibility simulations. Publish maximum supply or another explicit issuance bound, subsidy schedule, precision, fee rules, and overflow invariants.
5. Connect multiple independent nodes over a bounded peer protocol; test partitions, stale blocks, malicious peers, and restart recovery.
6. Run a public test network with valueless test coins, observability, and a documented upgrade process.
7. Obtain independent protocol/security review before any real-value deployment.
8. Add useful-compute payouts as a separately accounted service market; consider staking only after a separate threat-model review.

## 4. Economic invariants

- Every new coin is explained by a valid protocol subsidy or a valid transfer; no hidden minting path.
- Total supply arithmetic cannot overflow; all monetary values use integer base units.
- A block subsidy is a deterministic function of the agreed protocol rules.
- Fees are transferred/accounted for exactly once.
- Reorganizations reverse orphaned block rewards consistently.
- Useful-compute and storage payouts cannot be replayed or claimed twice.
- Rewards are not issued based solely on a participant's own unverified report.
- Mainnet genesis, initial allocation (if any), and protocol parameters are pinned and publicly auditable.

## 5. Risks and trade-offs

PoW makes attacks costly through external resource expenditure but may concentrate mining, consume energy, and create hardware barriers. Staking can reduce energy use but introduces stake concentration, validator coordination, and finality/slashing complexity. Useful-compute work can create practical utility but is often harder to verify than hashing. These incentives should not be conflated: security budget, service payments, and token issuance need separate accounting.

## 6. Current implementation boundary

CanonicalBlockV1, CanonicalChainV1, canonical signature validation, ledger replay, snapshots, and CanonicalNodeStore are building blocks for deterministic validation and local recovery. An isolated pow module now provides canonical header hashing, bounded nonce search, and target checks for experiments. It is not yet connected to block acceptance and does not derive targets from chain history. There is no cumulative-work fork-choice engine, difficulty adjustment, peer network, or protocol-level issuance rule.

No mainnet launch, token sale, exchange listing, or real-value claims are authorized by this proposal.
