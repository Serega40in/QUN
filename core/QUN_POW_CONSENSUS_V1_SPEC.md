# QUN PoW consensus v1 — activation gate

Status: design contract for implementation. **Not activated and not a claim of production readiness.** The existing `pow.rs` module only hashes a header and searches bounded nonces. It does not yet make a block valid for the chain.

## Non-negotiable invariants

1. A peer never chooses the target, reward, network ID, or expected parent for itself. Every node derives them from local protocol rules and validated history.
2. A block is accepted only after header work, body commitment, canonical transaction signatures, height/parent, timestamp rules, transaction state transitions, and issuance/fee rules all pass.
3. Fork choice is the valid chain with the greatest **cumulative work**, not the longest chain and not the chain received first. Equal-work ties must have a deterministic tie-break rule.
4. Invalid blocks and failed ledger transitions change neither chain nor ledger.
5. Integer-only accounting. No floating-point amounts. Every addition is checked for overflow.
6. Genesis and consensus parameters are versioned and network-specific. Changing them requires a protocol-version change, not an operator setting silently supplied by a peer.
7. A locally generated block is not considered confirmed until it is validated under the same rules as a remote block.

## Implementation order

### P1 — consensus parameter type
Create a versioned, immutable parameter structure covering network ID, genesis hash, initial target, target spacing, retarget window, allowed future timestamp drift, median-time window, maximum block body/transaction count, subsidy schedule, and fee policy. Validate parameter combinations at startup. Do not activate mainnet parameters while economics remain undecided in issue #93.

### P2 — target and work arithmetic
Implement fixed-width 256-bit target comparison and cumulative-work arithmetic with checked overflow. Derive per-block work from the validated target; never accept claimed work from a header. Add vectors at boundary targets (zero, one, maximum allowed, hash equal to target, hash one above target), and arithmetic carry/overflow tests.

### P3 — difficulty and time rules
Derive expected target from prior validated headers only. Add deterministic retargeting, clamp extreme changes, and validate timestamps against median past time and a bounded future drift. Specify integer rounding exactly and publish golden vectors before changing protocol version.

### P4 — chain selection
Store cumulative work with each candidate chain. Reject invalid branches before comparing work. Test a shorter high-work chain winning over a longer low-work chain, equal-work tie resolution, reorg rollback/replay, and adversarial target claims.

### P5 — rewards and transaction execution
Define subsidy, issuance cap or explicit supply policy, halving/decay if any, fee accounting, coinbase rules, and overflow handling. Verify that total issuance cannot exceed the protocol schedule and that a block cannot mint twice. Do not add automatic token rewards for unverified volunteer compute.

### P6 — two-process testnet
Run two independent nodes with separate data directories. Exercise peer sync, block propagation, temporary partitions, competing blocks, restart/replay, malformed messages, and recovery to the same highest-work valid chain. A unit test simulating two validators is not a substitute for this gate.

## Acceptance gates

- [ ] Independent implementations reproduce header, target, per-block work, and cumulative-work vectors byte-for-byte.
- [ ] A peer-supplied target or work value is ignored/rejected.
- [ ] Reorgs restore the prior state and replay the winning branch atomically.
- [ ] Restart reconstructs the same tip and ledger from persisted data.
- [ ] Fuzzing covers header/body decoders and network framing.
- [ ] Two-node integration tests pass on clean processes.
- [ ] External security review before real-value use.

## Current boundary

Already present in this branch: canonical transaction/block encodings, opt-in network-bound Ed25519 verification, in-memory canonical chain validation/replay, local persistence/replay checks, and experimental PoW header hashing/nonce search.

Still missing: consensus target derivation, difficulty adjustment, cumulative-work fork choice, integrated PoW block acceptance, P2P networking, issuance/reward rules, contract execution, and public RPC for the canonical chain. The current experimental PoW primitive must not be advertised as mining or a secure consensus implementation.
