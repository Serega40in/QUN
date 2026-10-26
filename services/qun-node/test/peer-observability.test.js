import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForHealth(url, child) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("QUN Node exited before becoming healthy");
    try {
      const response = await fetch(url + "/health");
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("QUN Node health endpoint did not become ready: " + url);
}

async function waitForCondition(fn, message, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

function startNode({ port, dataDir, nodeId, peer = "", token }) {
  return spawn(process.execPath, [path.join(process.cwd(), "src", "server.js")], {
    cwd: process.cwd(),
    stdio: ["ignore", "ignore", "pipe"],
    env: {
      ...process.env,
      QUN_NODE_HOST: "127.0.0.1",
      QUN_NODE_PORT: String(port),
      QUN_NODE_DATA_DIR: dataDir,
      QUN_NODE_ID: nodeId,
      QUN_NODE_PEERS: peer,
      QUN_NODE_SHARED_TOKEN: token,
      QUN_NODE_RECONCILE_INTERVAL_MS: "250"
    }
  });
}

async function stopNode(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise(resolve => child.once("exit", resolve)),
    new Promise(resolve => setTimeout(resolve, 1500))
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function put(base, id, data) {
  const response = await fetch(base + "/objects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, data })
  });
  assert.ok(response.status === 201 || response.status === 200, "synthetic object write should succeed");
}

test("health endpoint exposes peer reconciliation and immutable-object conflicts", { timeout: 30000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "qun-node-peer-observability-"));
  const portA = await freePort();
  let portB = await freePort();
  while (portA === portB) portB = await freePort();
  const urlA = "http://127.0.0.1:" + portA;
  const urlB = "http://127.0.0.1:" + portB;
  const dataA = path.join(root, "node-a");
  const dataB = path.join(root, "node-b");
  const token = "qun-observability-test-secret-at-least-32";
  const objectId = "immutable-conflict-test";
  let nodeA;
  let nodeB;

  try {
    // Seed independent, valid but intentionally conflicting immutable objects
    // before connecting the peers, so reconciliation cannot overwrite either.
    nodeA = startNode({ port: portA, dataDir: dataA, nodeId: "observe-a", token });
    await waitForHealth(urlA, nodeA);
    await put(urlA, objectId, "synthetic payload authored on peer A");

    nodeB = startNode({ port: portB, dataDir: dataB, nodeId: "observe-b", token });
    await waitForHealth(urlB, nodeB);
    await put(urlB, objectId, "different synthetic payload authored on peer B");
    await stopNode(nodeB);
    nodeB = null;

    nodeA = await (async () => {
      await stopNode(nodeA);
      return startNode({ port: portA, dataDir: dataA, nodeId: "observe-a", peer: urlB, token });
    })();
    await waitForHealth(urlA, nodeA);
    nodeB = startNode({ port: portB, dataDir: dataB, nodeId: "observe-b", peer: urlA, token });
    await waitForHealth(urlB, nodeB);

    await waitForCondition(async () => {
      const health = await (await fetch(urlA + "/health")).json();
      return health.reconciliation?.peers?.some(peer => peer.peer === urlB && peer.ok && peer.conflicts > 0);
    }, "Peer A did not expose the immutable-object conflict in /health");

    const healthA = await (await fetch(urlA + "/health")).json();
    const peerStatus = healthA.reconciliation.peers.find(peer => peer.peer === urlB);
    assert.equal(peerStatus.ok, true);
    assert.ok(peerStatus.checkedAt);
    assert.ok(peerStatus.conflicts > 0);

    const readA = await (await fetch(urlA + "/objects/" + objectId)).json();
    const readB = await (await fetch(urlB + "/objects/" + objectId)).json();
    assert.equal(readA.data, "synthetic payload authored on peer A");
    assert.equal(readB.data, "different synthetic payload authored on peer B");
  } finally {
    await stopNode(nodeA);
    await stopNode(nodeB);
    await rm(root, { recursive: true, force: true });
  }
});
