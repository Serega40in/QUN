import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
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
  throw new Error("QUN Node health endpoint did not become ready");
}

async function waitForCondition(fn, message, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(message);
}

function startNode({ port, dataDir, nodeId, peers = "", token }) {
  return spawn(process.execPath, [path.join(process.cwd(), "src", "server.js")], {
    cwd: process.cwd(),
    stdio: ["ignore", "ignore", "pipe"],
    env: {
      ...process.env,
      QUN_NODE_HOST: "127.0.0.1",
      QUN_NODE_PORT: String(port),
      QUN_NODE_DATA_DIR: dataDir,
      QUN_NODE_ID: nodeId,
      QUN_NODE_PEERS: peers,
      QUN_NODE_SHARED_TOKEN: token,
      QUN_NODE_RECONCILE_INTERVAL_MS: "500"
    }
  });
}

async function stopNode(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise(resolve => child.once("exit", resolve)),
    new Promise(resolve => setTimeout(resolve, 1500))
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

test("replication recovers after peer returns and repairs a corrupted copy", { timeout: 30000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "qun-node-repair-"));
  const portA = await freePort();
  const portB = await freePort();
  const token = "qun-test-only-shared-token-please-change-001";
  let nodeA;
  let nodeB;
  const urlA = "http://127.0.0.1:" + portA;
  const urlB = "http://127.0.0.1:" + portB;
  const dataA = path.join(root, "node-a");
  const dataB = path.join(root, "node-b");
  const objectId = "replica-repair-01";
  try {
    // Node B is deliberately offline when the first write occurs.
    nodeA = startNode({ port: portA, dataDir: dataA, nodeId: "node-a", peers: urlB, token });
    await waitForHealth(urlA, nodeA);
    const put = await fetch(urlA + "/objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: objectId, data: "synthetic QUN repair test object" })
    });
    assert.equal(put.status, 201);
    const initial = await put.json();
    assert.equal(initial.replication.succeeded, 0);

    // Once B returns, A's periodic reconciliation should create its missing copy.
    nodeB = startNode({ port: portB, dataDir: dataB, nodeId: "node-b", token });
    await waitForHealth(urlB, nodeB);
    await waitForCondition(async () => {
      try {
        const response = await fetch(urlB + "/objects/" + objectId);
        return response.ok && (await response.json()).data === "synthetic QUN repair test object";
      } catch { return false; }
    }, "Replica was not restored after the peer returned");

    // Simulate bit rot / local file corruption on B; A must restore the valid copy.
    await writeFile(path.join(dataB, "objects", objectId + ".bin"), "corrupted bytes");
    await waitForCondition(async () => {
      try {
        const response = await fetch(urlB + "/objects/" + objectId + "/verify");
        return response.ok && (await response.json()).valid === true;
      } catch { return false; }
    }, "Corrupted replica was not repaired");
    const bytes = await readFile(path.join(dataB, "objects", objectId + ".bin"), "utf8");
    assert.equal(bytes, "synthetic QUN repair test object");
  } finally {
    if (nodeA) await stopNode(nodeA);
    if (nodeB) await stopNode(nodeB);
    await rm(root, { recursive: true, force: true });
  }
});
