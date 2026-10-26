import test from "node:test";
import assert from "node:assert/strict";
import { generateWallet, createTransaction, QunLedger } from "./ledger.js";

function setup() {
  const alice = generateWallet();
  const bob = generateWallet();
  const carol = generateWallet();
  const ledger = new QunLedger({
    genesisAllocations: { [alice.address]: 1000, [bob.address]: 0 },
    maxSupply: 1000
  });
  return { alice, bob, carol, ledger };
}

function pay(wallet, to, amount, nonce) {
  return createTransaction({ to, amount, nonce, privateKey: wallet.privateKey, publicKey: wallet.publicKey });
}

test("valid signed transfer updates balances and verifies exported history", () => {
  const { alice, bob, ledger } = setup();
  const tx = pay(alice, bob.address, 125, 0);
  ledger.appendBlock([tx], 1000);
  assert.equal(ledger.getBalance(alice.address), 875);
  assert.equal(ledger.getBalance(bob.address), 125);
  assert.equal(ledger.getNonce(alice.address), 1);
  assert.equal(QunLedger.verifyChain(ledger.exportChain()).valid, true);
});

test("rejects duplicate spends and does not mutate state on failure", () => {
  const { alice, bob, carol, ledger } = setup();
  const tx = pay(alice, bob.address, 700, 0);
  ledger.appendBlock([tx], 1000);
  const before = ledger.exportChain();
  assert.throws(() => ledger.appendBlock([tx], 2000), /nonce|duplicate/);
  assert.equal(ledger.getBalance(alice.address), 300);
  assert.equal(ledger.getBalance(bob.address), 700);
  assert.deepEqual(ledger.exportChain(), before);
  assert.throws(() => ledger.appendBlock([pay(alice, carol.address, 1, 0)], 3000), /nonce/);
});

test("rejects invalid signatures and insufficient balance", () => {
  const { alice, bob, carol, ledger } = setup();
  const forged = pay(alice, bob.address, 10, 0);
  forged.amount = 999;
  assert.throws(() => ledger.appendBlock([forged], 1000), /signature|id mismatch/);
  assert.throws(() => ledger.appendBlock([pay(alice, carol.address, 1001, 0)], 1000), /insufficient balance/);
  assert.equal(ledger.getBalance(alice.address), 1000);
});

test("verifier detects modified history and broken block links", () => {
  const { alice, bob, ledger } = setup();
  ledger.appendBlock([pay(alice, bob.address, 25, 0)], 1000);
  const changed = ledger.exportChain();
  changed.blocks[1].transactions[0].amount = 26;
  assert.equal(QunLedger.verifyChain(changed).valid, false);

  const brokenLink = ledger.exportChain();
  brokenLink.blocks[1].previousHash = "f".repeat(64);
  assert.equal(QunLedger.verifyChain(brokenLink).valid, false);
});

test("enforces genesis supply cap and rejects invalid allocations", () => {
  const alice = generateWallet();
  assert.throws(() => new QunLedger({
    genesisAllocations: { [alice.address]: 1001 },
    maxSupply: 1000
  }), /maxSupply/);
  assert.throws(() => new QunLedger({
    genesisAllocations: { invalid: 1 },
    maxSupply: 1000
  }), /address/);
});
