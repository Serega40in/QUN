import { createHash, createPublicKey, sign, verify, generateKeyPairSync } from "node:crypto";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const canonical = value => JSON.stringify(value);

export function generateWallet() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  return {
    publicKey: publicKeyPem,
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
    address: addressFromPublicKey(publicKeyPem)
  };
}

export function addressFromPublicKey(publicKeyPem) {
  return sha256(createPublicKey(publicKeyPem).export({ type: "spki", format: "der" }));
}

function txPayload(tx) {
  return {
    version: tx.version,
    from: tx.from,
    to: tx.to,
    amount: tx.amount,
    nonce: tx.nonce,
    publicKey: tx.publicKey
  };
}

export function createTransaction({ to, amount, nonce, privateKey, publicKey }) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("amount must be a positive safe integer");
  if (!Number.isSafeInteger(nonce) || nonce < 0) throw new Error("nonce must be a non-negative safe integer");
  const from = addressFromPublicKey(publicKey);
  const tx = { version: 1, from, to, amount, nonce, publicKey, signature: "" };
  tx.signature = sign(null, Buffer.from(canonical(txPayload(tx))), privateKey).toString("base64");
  tx.id = sha256(canonical({ ...txPayload(tx), signature: tx.signature }));
  return tx;
}

function blockPayload(block) {
  return {
    version: block.version,
    height: block.height,
    previousHash: block.previousHash,
    timestamp: block.timestamp,
    transactions: block.transactions
  };
}

function blockHash(block) {
  return sha256(canonical(blockPayload(block)));
}

function cloneState(state) {
  return {
    balances: new Map(state.balances),
    nonces: new Map(state.nonces),
    seenTransactions: new Set(state.seenTransactions),
    totalSupply: state.totalSupply
  };
}

function applyTransaction(tx, state) {
  if (!tx || tx.version !== 1 || typeof tx.to !== "string" || !tx.to || tx.to.length > 128) {
    throw new Error("invalid transaction shape");
  }
  if (!Number.isSafeInteger(tx.amount) || tx.amount <= 0) throw new Error("invalid amount");
  if (!Number.isSafeInteger(tx.nonce) || tx.nonce < 0) throw new Error("invalid nonce");
  if (typeof tx.publicKey !== "string" || typeof tx.signature !== "string") throw new Error("missing signature material");
  const sender = addressFromPublicKey(tx.publicKey);
  if (sender !== tx.from) throw new Error("sender does not match public key");
  const payload = canonical(txPayload(tx));
  if (!verify(null, Buffer.from(payload), createPublicKey(tx.publicKey), Buffer.from(tx.signature, "base64"))) {
    throw new Error("invalid transaction signature");
  }
  const expectedId = sha256(canonical({ ...txPayload(tx), signature: tx.signature }));
  if (tx.id !== expectedId) throw new Error("transaction id mismatch");
  if (state.seenTransactions.has(tx.id)) throw new Error("duplicate transaction");
  const expectedNonce = state.nonces.get(sender) ?? 0;
  if (tx.nonce !== expectedNonce) throw new Error("invalid nonce: expected " + expectedNonce);
  const balance = state.balances.get(sender) ?? 0;
  if (balance < tx.amount) throw new Error("insufficient balance");
  state.balances.set(sender, balance - tx.amount);
  state.balances.set(tx.to, (state.balances.get(tx.to) ?? 0) + tx.amount);
  state.nonces.set(sender, expectedNonce + 1);
  state.seenTransactions.add(tx.id);
}

export class QunLedger {
  constructor({ genesisAllocations, maxSupply }) {
    if (!genesisAllocations || typeof genesisAllocations !== "object" || Array.isArray(genesisAllocations)) {
      throw new Error("genesisAllocations must be an address-to-amount object");
    }
    if (!Number.isSafeInteger(maxSupply) || maxSupply <= 0) throw new Error("maxSupply must be a positive safe integer");
    const entries = Object.entries(genesisAllocations).sort(([a], [b]) => a.localeCompare(b));
    const balances = new Map();
    let totalSupply = 0;
    for (const [address, amount] of entries) {
      if (!/^[a-f0-9]{64}$/.test(address)) throw new Error("invalid genesis address");
      if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("invalid genesis allocation");
      totalSupply += amount;
      if (!Number.isSafeInteger(totalSupply) || totalSupply > maxSupply) throw new Error("genesis exceeds maxSupply");
      if (amount > 0) balances.set(address, amount);
    }
    this.maxSupply = maxSupply;
    this.genesis = { version: 1, maxSupply, allocations: Object.fromEntries(entries) };
    this.blocks = [{
      version: 1,
      height: 0,
      previousHash: "0".repeat(64),
      timestamp: 0,
      transactions: [],
      hash: sha256(canonical(this.genesis))
    }];
    this.state = { balances, nonces: new Map(), seenTransactions: new Set(), totalSupply };
  }

  getBalance(address) {
    return this.state.balances.get(address) ?? 0;
  }

  getNonce(address) {
    return this.state.nonces.get(address) ?? 0;
  }

  getTip() {
    const block = this.blocks[this.blocks.length - 1];
    return { height: block.height, hash: block.hash };
  }

  appendBlock(transactions, timestamp = Date.now()) {
    if (!Array.isArray(transactions) || transactions.length === 0) throw new Error("block must contain at least one transaction");
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new Error("invalid timestamp");
    const nextState = cloneState(this.state);
    for (const tx of transactions) applyTransaction(tx, nextState);
    const previous = this.blocks[this.blocks.length - 1];
    const block = {
      version: 1,
      height: previous.height + 1,
      previousHash: previous.hash,
      timestamp,
      transactions: JSON.parse(JSON.stringify(transactions))
    };
    block.hash = blockHash(block);
    this.blocks.push(block);
    this.state = nextState;
    return JSON.parse(JSON.stringify(block));
  }

  exportChain() {
    return JSON.parse(JSON.stringify({ genesis: this.genesis, blocks: this.blocks }));
  }

  static verifyChain(exported) {
    try {
      if (!exported || !exported.genesis || !Array.isArray(exported.blocks) || exported.blocks.length < 1) {
        return { valid: false, error: "invalid chain structure" };
      }
      const ledger = new QunLedger({
        genesisAllocations: exported.genesis.allocations,
        maxSupply: exported.genesis.maxSupply
      });
      if (canonical(ledger.genesis) !== canonical(exported.genesis)) return { valid: false, error: "genesis mismatch" };
      const genesis = exported.blocks[0];
      if (canonical(genesis) !== canonical(ledger.blocks[0])) return { valid: false, error: "genesis block mismatch" };
      for (let i = 1; i < exported.blocks.length; i++) {
        const block = exported.blocks[i];
        const previous = ledger.blocks[ledger.blocks.length - 1];
        if (block.height !== previous.height + 1) throw new Error("invalid block height");
        if (block.previousHash !== previous.hash) throw new Error("previous hash mismatch");
        if (block.hash !== blockHash(block)) throw new Error("block hash mismatch");
        if (!Number.isSafeInteger(block.timestamp) || block.timestamp < previous.timestamp) throw new Error("invalid block timestamp");
        ledger.appendBlock(block.transactions, block.timestamp);
        const appended = ledger.blocks[ledger.blocks.length - 1];
        if (appended.hash !== block.hash) throw new Error("replayed block mismatch");
      }
      return { valid: true, height: ledger.blocks.length - 1, tipHash: ledger.getTip().hash, totalSupply: ledger.state.totalSupply };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : "verification failed" };
    }
  }
}
