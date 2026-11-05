# QUN Core canonical encoding v1 — implementation gate

Status: isolated v1 primitives implemented for review. This document does not change the current wire format or activate a public network.

## Why this is next

The current prototype hashes JSON serialization. That is workable for a single Rust process, but consensus-critical bytes must be specified independently of serializer behavior before independent nodes can agree on block IDs. Do not introduce P2P or real-value assets while the canonical encoding and state transition rules are unsettled.

## Design goals

- Same logical input produces identical bytes and hashes on every supported implementation.
- Every variable-length field has an unambiguous length prefix and a documented maximum.
- Integers use fixed-width unsigned big-endian encoding; no floating-point values.
- Domain separation and explicit protocol versions prevent a transaction payload from being confused with a block payload.
- Golden test vectors are checked into the repository and verified by every implementation.
- Existing prototype snapshots remain readable only through an explicit legacy path; they must not silently become consensus-compatible v1 data.

## Proposed encoding primitives

- u16, u32, u64: unsigned, big-endian.
- bytes: u32 byte length followed by exactly that many bytes.
- text: UTF-8 bytes encoded as bytes; reject invalid UTF-8 on decode.
- fixed[N]: exactly N bytes, with no length prefix.
- Reject unknown versions, trailing bytes, truncated values, oversized fields, and non-canonical encodings.

All encoders and decoders must be bounded. Proposed initial limits: 128 bytes for a recipient identifier, 1,024 transactions per block, and a documented maximum encoded block size. These limits must be checked before allocation and finalized alongside the network protocol.

## Proposed transaction signing payload

1. Fixed domain bytes QUN-TX.
2. u16 protocol version (1).
3. Fixed 32-byte network identifier.
4. Sender public key as fixed[32] (not hex text).
5. Recipient identifier as text.
6. Amount as u64.
7. Nonce as u64.

The Ed25519 signature covers these exact bytes. Hex is a display/JSON transport representation only, never part of the signed byte representation. The network identifier prevents the same signature from being replayed across networks.

## Proposed block hash payload

1. Fixed domain bytes QUN-BLOCK.
2. u16 protocol version (1).
3. Fixed 32-byte network identifier.
4. Block height as u64.
5. Timestamp as u64.
6. Parent block hash as fixed[32].
7. Transaction count as u32.
8. For each transaction, encode the complete canonical transaction payload and signature envelope with explicit lengths.

The block identifier is SHA-256 of this payload. Genesis parameters and genesis hash must be specified and pinned before a public devnet. The chain must reject a block whose transaction list differs from its signed envelopes.

## State-transition invariants

- Verify all signatures and all transaction fields before committing state.
- Execute transactions in the exact order encoded in the block.
- Reject replayed or skipped nonces, zero amounts, self-transfers, insufficient balances, arithmetic overflow, invalid sender encodings, and unknown network identifiers.
- A rejected block must leave chain, ledger, and persisted snapshot unchanged.
- Define an explicit state commitment (state root) before independent-node consensus; do not treat the current JSON ledger snapshot as authoritative consensus state.
- Development funding must be impossible in any public-node profile.

## Compatibility and rollout

1. Keep the isolated transaction/block encoders and decoders plus golden test vectors additive; do not change current hashes until migration and protocol activation are reviewed.
2. Add tests for boundary values, malformed/truncated inputs, trailing bytes, wrong domain/version/network, and cross-language vectors.
3. Add a new explicitly versioned block format and snapshot migration policy. Never reinterpret legacy hashes as v1 hashes.
4. Validate the entire chain and state transition history when loading a v1 snapshot.
5. Only after tests pass, expose the v1 format to a local multi-node harness.
6. Decide consensus and fork-choice rules before peer networking; canonical bytes alone do not create consensus.

## Acceptance criteria

- The Rust implementation includes bounded transaction/block encoding and decoding, strict embedded-transaction validation, a pinned transaction byte vector and SHA-256 digest, plus malformed-input regression tests. This is not yet a complete cross-language golden-vector suite.

- Golden vectors are stable and documented.
- Independent implementations produce identical transaction bytes, signatures, block bytes, and block hashes.
- Invalid/non-canonical input is rejected deterministically.
- Existing local demo behavior remains clearly labelled and cannot be mistaken for the v1 protocol.
- CI runs formatting checks, Clippy, unit tests, and integration tests without mutating tracked source files.
- No public network, exchange listing, or real-value token is claimed from this design document alone.
