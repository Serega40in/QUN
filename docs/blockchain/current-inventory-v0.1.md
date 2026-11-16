# QUN Blockchain — verified repository inventory v0.1

**Checked:** 2026-11-16  
**Purpose:** distinguish confirmed repository contents from unverified token/network claims. This is an engineering inventory, not an on-chain verification report.

## Confirmed

| Item | Evidence | Status |
|---|---|---|
| `Serega40in/qun-core-01` | README describes Hardhat + OpenZeppelin ERC-20 and local development chain | Local prototype only; not a sovereign QUN network and not a verified public token |
| `Serega40in/Yon-deploy` | GitHub repository metadata reports size 0; README fetch returns 404 | No deployment source can currently be audited from this repository |
| `Serega40in/Yon-claimer` | Repository exists; README fetch returns 404 | Contents and purpose remain unverified from available root documentation |
| `Serega40in/QUN` | Contains QUN Core engineering work and blockchain roadmaps | Development repository; code presence alone does not prove any public network or deployment |
| QUN Supabase project | Existing Edge Functions and QUN Compute services are present | Backend services exist; this is not proof of a TON contract or sovereign-chain deployment |

## Not yet verified

- YON token contract address and whether it is on TON mainnet or testnet.
- The old compromised address, current owner/admin permissions, supply, mint authority and upgrade controls.
- Any live QUN/YON Jetton, NFT/team-card contract, escrow, allocation ledger or bridge.
- Whether an existing token can be safely administered after the reported wallet compromise.

## Required next steps

1. Locate the authoritative TON explorer URL / contract address from project records; verify it independently before making contract changes.
2. Recover the original source and deployment metadata from the actual repository, local files, or explorer verification. Do not infer a contract address from repository names.
3. Read contract permissions and determine whether the compromised wallet can still mint, upgrade, pause or transfer assets.
4. Build a test-only TON integration with test wallets and reproducible tests.
5. Separately specify QUN Sovereign Chain using the existing `qun-core-01` prototype as a reference, not as a production network.
6. Keep the two tracks separate; no mainnet transaction, key migration, bridge or paid infrastructure without explicit approval.

## Security note

Never paste a seed phrase or private key into GitHub, Supabase, ChatGPT, logs or an issue. If a wallet is compromised, treat it as compromised; verify recovery and authority options without sharing secrets.
