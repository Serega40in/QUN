# QUN Chain Prototype 0.1

Experimental, dependency-free Node.js ledger prototype. This is a first step toward a verifiable transaction history, **not a production blockchain and not a cryptocurrency for real funds**.

## Included

- Ed25519 wallet key generation and public-key-derived addresses.
- Signed transfers; the private key never needs to be sent to a server.
- Positive integer amounts (smallest indivisible units only), per-sender sequence numbers, and balance checks.
- Duplicate transaction rejection.
- Hash-linked blocks and deterministic block hashes.
- Exported-chain replay verification: signatures, balances, sequence numbers, block links, block hashes and genesis allocation are checked.
- Fixed genesis allocation and a configured maximum supply. Transfers do not mint new units.

## Run tests

Requires Node.js 20 or newer:

```sh
npm test
```

## Minimal example

```js
import { generateWallet, createTransaction, QunLedger } from "./ledger.js";

const alice = generateWallet();
const bob = generateWallet();
const ledger = new QunLedger({
  genesisAllocations: { [alice.address]: 1000 },
  maxSupply: 1000
});
const tx = createTransaction({
  to: bob.address,
  amount: 25,
  nonce: ledger.getNonce(alice.address),
  privateKey: alice.privateKey,
  publicKey: alice.publicKey
});
ledger.appendBlock([tx]);
console.log(ledger.getBalance(bob.address)); // 25
console.log(QunLedger.verifyChain(ledger.exportChain()));
```

Keep private keys secure; the test helper returns a PEM private key for local experimentation only. Do not store real private keys in source control, logs, browsers, or a shared server.

## Explicit limitations

This prototype is an in-memory, single-process ledger. It has **no P2P transport, validator set, consensus, fork-choice rule, durable database, fee system, smart contracts, reward engine, Sybil resistance, or economic security**. A single operator can choose which blocks to append. Hashes and signatures make edits detectable when verifying a known chain, but do not make competing histories agree.

The configured `maxSupply` constrains initial genesis allocation; this prototype has no minting transaction at all. Do not connect balances to QUN Node rewards, exchanges, wallets holding real assets, or a public mainnet. Next steps after these tests: persistence and restart tests, independent-node transaction exchange, then a separately designed consensus protocol and adversarial tests.
