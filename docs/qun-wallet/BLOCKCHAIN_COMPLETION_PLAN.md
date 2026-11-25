# QUN Wallet — blockchain completion plan

**Status:** implementation plan; not a claim that the listed features are already live.
**Current app:** `docs/qun-wallet/`
**Primary target:** TON Testnet first. Keep the existing QUN_TEST Supabase ledger clearly separate from on-chain assets.

## Current verified baseline

- The existing QUN wallet ledger is internal Supabase accounting, not a blockchain wallet.
- TON Connect currently connects a user wallet on TON Testnet and displays its address and native TON Testnet balance.
- TON Connect's `sendTransaction` flow is being added in PR #114. It is not merged or browser-tested yet.
- Never request or store a user's seed phrase or private key in the dApp.
- Do not represent testnet assets or internal QUN_TEST balances as money or promise returns.

## Milestone 1 — TON Testnet transfers

- Use TON Connect `sendTransaction` with explicit network ID `-3` on the testnet page.
- Convert decimal TON to integer nanoton without floating-point arithmetic; allow at most 9 decimal places.
- Let the connected wallet display and approve the transaction.
- Show a clear state for request, rejection/error, and wallet submission. Do not label a submitted message as confirmed until chain data verifies it.
- Add explorer links based on a verified transaction identifier when available; do not guess the transaction from the sender's latest activity.
- Test two separately funded testnet wallets: A→B, B→A, wrong address, zero/negative amount, excessive precision, user rejection, insufficient balance, network mismatch, and retry behaviour.
- Never silently fall back to mainnet.

## Milestone 2 — multi-chain adapter boundary

Keep chain-specific code out of the QUN_TEST ledger. Define a common adapter contract for:
- connect/disconnect and current account;
- chain ID and network label;
- native balance and supported asset balances;
- transaction preparation, wallet approval, submission and confirmation lookup;
- explorer URL and normalized error states.

Implement TON first. Add another chain only after its wallet protocol, testnet, token standards, fee handling and transaction verification are selected. Never treat an address from one chain as valid on another.

## Milestone 3 — NFT minting and rarity

- Define collection configuration and versioned metadata before deploying a collection contract.
- Store metadata in stable, content-addressed or otherwise immutable storage; include a content hash so metadata changes can be detected.
- Use a TON-compatible NFT collection/item implementation and verify it against the selected TEP-62/TEP-64 behaviour before release.
- Generate rarity from a declared trait schema and fixed rarity rules. Publish trait weights and collection supply assumptions. Rarity is descriptive, not a promise of price or future value.
- Freeze or version rarity calculations at mint time. If a collection's metadata or scoring algorithm changes, preserve the old version and explain the change.
- Record collection address, item address, owner, metadata URI/hash and transaction link. Read ownership from chain rather than trusting a client-side database.
- Tests: unique item addresses/IDs, duplicate mint prevention, metadata hash stability, trait validation, rarity determinism, transfer/ownership update and malformed metadata.

## Milestone 4 — staking

- Decide the exact asset and purpose before writing the contract: native TON, a specified Jetton, or a QUN token only after its contract and tokenomics are established.
- Choose and document lock-up, early exit, reward funding, reward calculation, rounding, caps, pause/emergency exit, admin permissions and contract upgrade policy.
- Use an on-chain staking contract for actual on-chain assets. A Supabase row may be an index/cache but must not be the source of truth for custody or balances.
- Rewards must come from an explicitly funded pool or a documented contribution programme. Do not promise yield or imply guaranteed profit.
- Include a testnet-only staging phase and independent contract review before any mainnet funds are accepted.
- Tests: stake, partial/full unstake, repeated requests, reward calculation, rounding, underfunded reward pool, lock expiry, unauthorized admin action, pause/emergency path and invariant checks.

## Release gates

1. Code review and automated checks pass.
2. TON Connect manifest is publicly reachable over HTTPS and returns valid JSON.
3. Browser tests pass on desktop and mobile.
4. Two testnet accounts complete transfers and the transaction is verified in a TON Testnet explorer.
5. NFT and staking contracts are deployed to testnet, source/build artifacts and addresses are recorded, and test cases pass.
6. No production/mainnet switch until security review, monitoring, recovery plan and explicit release approval.

## Official protocol references

- TON Connect overview: https://docs.ton.org/applications/ton-connect/overview
- TON Connect setup and manifest: https://docs.ton.org/applications/ton-connect/get-started
- TON Connect transaction requests: https://docs.ton.org/applications/ton-connect/how-to/send-transaction
- TON NFT standard TEP-62: https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md
- TON NFT metadata TEP-64: https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md
