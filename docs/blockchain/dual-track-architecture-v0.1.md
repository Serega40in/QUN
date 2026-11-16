# QUN Blockchain — dual-track architecture v0.1

**Status:** engineering plan, not a claim that a QUN mainnet or audited TON contracts are live.

QUN will pursue two complementary tracks:
1. **QUN Sovereign Chain** — an independent blockchain with its own consensus, validators, native asset, execution rules and network governance.
2. **QUN on TON** — QUN assets and applications deployed as TON smart contracts, using TON wallets and network infrastructure where appropriate.

These are distinct networks. A token on TON is not the native coin of an independent QUN chain. Any cross-chain representation requires an explicit bridge design and independent security review.

## Principles
- Reuse QUN Core, QUN Node, QUN Compute and existing identity/work queues where technically appropriate; do not create duplicate control planes.
- Start with testnets, local/devnet and test assets. Never imply mainnet, liquidity, exchange listings or audited security without evidence.
- No paid infrastructure, validators, deployments or transactions without explicit approval.
- Private keys and seed phrases must never be stored in GitHub, application logs, or Supabase tables.
- Use reproducible builds, pinned dependencies, tests, versioned specs and rollback plans.
- Never promise price appreciation or investment returns.

## Track A — QUN on TON
1. Inventory existing repositories, contract source, deployment scripts, wallet addresses and current network (testnet/mainnet); treat all addresses as unverified until checked against an explorer.
2. Reproduce and test the current contract build; document compiler/toolchain versions and contract permissions.
3. Add tests for access control, supply/accounting invariants, replay protection where relevant, and failure cases.
4. Separate token, NFT/team-card, allocation ledger and escrow/payout concepts. Do not combine them into one privileged contract without a threat model.
5. Deploy to TON testnet first; verify source/build and run end-to-end tests with test wallets.
6. Mainnet release only after explicit approval, reviewed permissions, migration/upgrade plan, and independent security review appropriate to the risk.

## Track B — Sovereign QUN Chain
1. **Specification first:** threat model, state machine, transaction format, account/key model, fees, supply policy, finality, validator rules and governance.
2. **Prototype:** a single-node deterministic devnet with block production, transaction validation, persistent state, RPC and health endpoint.
3. **Multi-node testnet:** independent nodes, peer discovery, signed messages, deterministic state transitions, restart/recovery and partition tests.
4. **Consensus decision:** evaluate mature, well-reviewed consensus implementations suitable for the intended validator model. Do not invent cryptography or claim Byzantine fault tolerance without proof.
5. **Wallet and explorer:** testnet-only initially; key handling client-side, clear network identifiers, transaction status and block explorer.
6. **Security/economics:** adversarial tests, spam/DoS limits, fee/supply simulation, validator incentives and governance analysis.
7. **Mainnet gate:** independent review, reproducible release, monitoring, incident response, genesis ceremony, validator diversity and explicit go/no-go approval.

## Cross-chain direction
- Initially keep TON and QUN sovereign-chain assets separate.
- Later evaluate a bridge only after both chains have stable finality and documented validator/security assumptions.
- A bridge must define custody/locking or mint/burn rules, proof verification, replay protection, pause/recovery controls, monitoring and incident response.
- No bridge launch based only on a demo; bridge risk is high and requires independent review.

## Current status discipline
- **Confirmed:** QUN repository contains development work and an existing QUN Compute/Supabase backend.
- **Not established by this document:** a production sovereign QUN chain, a live audited QUN mainnet, a verified QUN TON token contract, or a functioning bridge.
- **Next concrete milestone:** repository and contract inventory, then a reproducible TON testnet test and a minimal sovereign-chain technical specification. Work in branches and PRs; do not deploy or spend funds automatically.
