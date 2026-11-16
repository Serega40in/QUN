# QUN Blockchain Foundation — TON-first plan

**Status:** proposal for the first working blockchain release  
**Updated:** 2026-11-10  
**Branch:** `feat/qun-ton-blockchain-foundation`

## 1. Current verified state

QUN does not yet operate its own blockchain.

- **QUN Wallet** at `docs/qun-wallet/` is a Supabase-backed internal test ledger. It has QUN ID login, a test balance, transfers between test wallets and transaction history. It does not create private keys, broadcast blockchain transactions or hold real assets.
- **QUN Core 0.1** in the separate `Serega40in/qun-core-01` repository contains a local Hardhat EVM and a capped ERC-20 test contract. It runs on a local development chain; it is not an independent QUN network.
- There is no confirmed QUN public testnet/mainnet, validator set, public RPC, explorer, production token or audited contract.

Keep these labels visible until the relevant feature is genuinely on-chain. Never describe the Supabase ledger as a blockchain.

## 2. Recommended first network: TON

For the first usable public blockchain integration, use **TON Testnet for development and TON Mainnet for production transactions**.

Why this is the practical first step:

- It gives QUN real public-chain transactions and smart-contract execution without requiring us to operate a new consensus network.
- TON Connect is designed to connect web apps and Telegram Mini Apps to user wallets. The user approves transactions in their wallet; QUN never receives the seed phrase or private key.
- TON supports native Toncoin transfers and Jetton tokens, plus NFTs and general smart contracts.
- It fits the QUN Telegram Mini App and community direction.

This is a **QUN ecosystem on TON**, not a claim that TON is a QUN-owned blockchain. An independent QUN EVM chain remains a possible later project, after there is a real need and a sustainable validator/operator plan.

Official references:
- [TON developer documentation](https://docs.ton.org/)
- [TON Connect overview](https://docs.ton.org/applications/ton-connect/overview)
- [TON Connect setup](https://docs.ton.org/applications/ton-connect/get-started)
- [TON Proof authentication](https://docs.ton.org/applications/ton-connect/how-to/ton-proof)
- [TON smart-contract overview](https://docs.ton.org/contracts/overview)
- [Jetton payment processing and validation](https://docs.ton.org/applications/payments/jettons)

## 3. Target architecture

```text
QUN Web / Telegram Mini App / QUN Market
                  |
            QUN Wallet UI
                  |
          TON Connect session
                  |
      User's external TON wallet
       (user controls all keys)
                  |
       TON Testnet / TON Mainnet
          |                 |
   Native TON sends    Tolk contracts
                            |
                    Jettons / NFTs /
                    QUN app contracts

QUN ID ----- signed ton_proof challenge ---- Backend verification
   |                                         |
   +---------- wallet address link ----------+
                                             |
                              read-only chain indexer/API
                                             |
                          QUN UI / order status / history
```

### Responsibilities

- **QUN ID:** application identity and authorization. It does not own the user's wallet.
- **TON Connect:** wallet connection, transaction requests and signed proofs.
- **External wallet:** stores and uses the private key; users approve each transaction.
- **TON blockchain:** authoritative source for on-chain balances, contract state and transaction outcomes.
- **QUN backend:** verifies one-time `ton_proof` challenges, reads/indexes chain data, stores application metadata and prevents duplicate business actions. It must not be able to fabricate on-chain confirmations.
- **Supabase:** app database and index/cache only. It is not the source of truth for an on-chain balance.
- **GitHub Pages:** serves the QUN interface and the public TON Connect manifest. It must never contain signing secrets.

## 4. Smart-contract toolchain

For new TON contracts, use **Tolk + Acton**. Current TON documentation recommends Tolk as the smart-contract language and Acton as the end-to-end toolchain for scaffolding, compilation, testing, debugging and deployment. Blueprint remains supported for older projects, but is not the default for a new Tolk project.

Rules:
- Contracts are built and tested locally first.
- Every contract has automated tests for expected and rejected messages, access control, boundaries and failure cases.
- Deploy to TON Testnet before any Mainnet release.
- Keep source, tests, deployment scripts, generated interfaces and verified build metadata in GitHub.
- Do not deploy privileged production contracts controlled by one personal hot wallet. Production administration needs a reviewed governance/multisig and recovery design.
- Do not copy the local Solidity prototype into TON mechanically. Reimplement and test the intended behavior using TON's execution and message model.

## 5. Wallet and identity milestones

### M0 — Honest baseline
- Preserve the current QUN Wallet ledger as a clearly labelled internal test ledger.
- Keep its test QUN separate from native TON and any future Jetton.
- Document that existing test balances cannot be redeemed or automatically migrated to real assets.

**Acceptance:** the UI and README clearly distinguish internal test balances from blockchain assets.

### M1 — Connect a real testnet wallet
- Add the official TON Connect flow to the existing QUN Wallet frontend.
- Publish `tonconnect-manifest.json` over HTTPS at a stable QUN URL; ensure it is publicly readable without login or restrictive CORS.
- Display the connected address, selected network and native TON balance.
- Add disconnect and wrong-network states.
- Never request or store seed phrases/private keys.

**Acceptance:** a user connects a personal wallet, sees its testnet address and balance, disconnects, reloads and reconnects safely.

### M2 — Verify QUN ID wallet ownership
- Backend issues a random, single-use challenge tied to the authenticated QUN ID session.
- Wallet signs it using `ton_proof`.
- Backend verifies signature, expected app domain, wallet address, timestamp and one-time challenge before linking the address.
- Reject expired proofs, replayed challenges, wrong domains and a wallet already linked where policy does not permit it.

**Acceptance:** a QUN ID account can prove control of a wallet without exposing its private key; replay tests fail.

### M3 — Real testnet transfers
- Enable native Toncoin transfer requests through TON Connect.
- Show recipient, amount, network and estimated fee before asking the wallet to approve.
- Treat wallet approval/broadcast as pending, not confirmed.
- Verify the resulting transaction on-chain and update history only after the chosen confirmation/finality rule is met.
- Test rejected, expired, duplicated, underfunded and wrong-network transactions.

**Acceptance:** two independently controlled testnet wallets can send and receive test Toncoin; both sides can inspect the on-chain transaction.

### M4 — First QUN smart contract
- Set up a small Tolk/Acton project with reproducible builds and automated tests.
- Start with a harmless example contract (for example, a counter or registry) to validate deployment and interaction.
- Deploy to TON Testnet from a wallet-controlled signing flow.
- Publish source code, tests, deployment address, network and explorer link.

**Acceptance:** a user can call a tested contract on Testnet, observe the state change and verify the transaction.

### M5 — QUN Jetton and app payments
Only after token purpose, supply, decimals, mint/burn permissions, treasury, governance and legal review are agreed:
- Implement a Jetton using the current standard and tested reference patterns.
- Add an allowlist of the exact Jetton master contract address.
- Validate Jetton wallet derivation and transfer notifications; never trust a token symbol or a user-supplied token address.
- Pilot one low-risk QUN use case, such as a test purchase in QUN Market.
- Keep payment state pending until the chain event has been independently verified and made idempotent.

**Acceptance:** the QUN app recognizes only the approved Jetton contract and records a payment once, only after a valid on-chain transfer.

### M6 — Developer platform
- Publish a QUN Developer page with network selection, RPC/API references, contract addresses, verified source, sample projects and SDK examples.
- Provide a Testnet starter template and deploy guide.
- Add contract interaction examples for QUN Market, Mini App and other QUN services.
- Add a public status page for supported networks and services.

**Acceptance:** an external developer can clone the starter, run tests, deploy to Testnet and connect a demo app without privileged QUN credentials.

## 6. Security and operational gates

- Testnet first. Mainnet uses real TON and fees; no mainnet transaction or token deployment happens without explicit approval.
- Never store seed phrases or private keys in QUN, Supabase, GitHub, browser local storage, Telegram bot secrets or AI prompts.
- Browser code may contain only public configuration and public keys.
- Verify every incoming payment against the exact chain, recipient, asset master, amount, transaction status and a unique business reference.
- Make webhook/indexer processing idempotent and resilient to retries, out-of-order events and API outages.
- Keep a replayable source of chain events; database rows are derived records, not proof of payment.
- Add rate limits, monitoring, backups, dependency scanning and incident/recovery procedures.
- Independent contract security review is required before real-value use.
- No rewards for QUN Node, compute or storage are payable until the reward rules and on-chain verification are implemented and audited.

## 7. Costs and limits

- Local development and public Testnet are the initial target; testnet coins are for testing only.
- Mainnet transfers and contract operations require real TON for network fees.
- Public API free tiers, if used, can have rate limits and availability constraints. Keep the integration replaceable and do not hardwire the whole ecosystem to one provider.
- Running a genuinely independent public QUN chain is not a free shortcut: it requires continuously available validator infrastructure, operators, monitoring, upgrades, consensus governance, RPC services and an explorer.

## 8. Own QUN chain — later decision, not the first dependency

Revisit an independent EVM-compatible QUN chain only when the ecosystem has:
- a concrete use case that TON or another established chain cannot meet;
- multiple independent validator operators (not a single laptop or a single cloud account);
- an agreed consensus and validator admission/governance model;
- sustained RPC, explorer, archive, monitoring and backup operations;
- a reviewed genesis, chain parameters, upgrade process and incident plan;
- independent security review and a realistic operating budget.

Until these conditions are met, do not label the existing local Hardhat chain or Supabase ledger as a QUN public blockchain.

## 9. Immediate implementation order

1. Confirm the QUN Wallet frontend integration point and preserve the existing QUN ID login.
2. Add TON Connect and a public manifest; test wallet connect/disconnect on Testnet.
3. Add a backend-verified `ton_proof` link to QUN ID.
4. Read actual Testnet balances and transaction history.
5. Send native testnet TON between two independent wallets.
6. Scaffold and test the first Tolk/Acton contract.
7. Decide QUN tokenomics only after the wallet and contract pipeline works.

**First release definition:** QUN Wallet can connect a user-owned TON Testnet wallet, prove wallet ownership to QUN ID, display real on-chain testnet balance, send and receive native testnet TON, and show independently verified transaction history. No real-money promise, no custodial keys and no premature token launch.
