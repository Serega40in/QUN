import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sha256 } from "../src/storage.js";

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

async function waitForObject(base, id, expected) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(base + "/objects/" + id);
      if (response.ok) {
        const object = await response.json();
        if (object.data === expected && object.sha256 === sha256(Buffer.from(expected, "utf8"))) return;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error("Object " + id + " was not replicated to " + base);
}

function startNode({ port, dataDir, nodeId, peer, token }) {
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
      QUN_NODE_RECONCILE_INTERVAL_MS: "300"
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

test("two independently running peers exchange objects in both directions", { timeout: 30000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "qun-node-bidirectional-"));
  const portA = await freePort();
  let portB = await freePort();
  while (portB === portA) portB = await freePort();
  const urlA = "http://127.0.0.1:" + portA;
  const urlB = "http://127.0.0.1:" + portB;
  const token = "qun-bidirectional-test-secret-at-least-32";
  let nodeA;
  let nodeB;

  try {
    nodeA = startNode({
      port: portA,
      dataDir: path.join(root, "node-a"),
      nodeId: "bidirectional-a",
      peer: urlB,
      token
    });
    await waitForHealth(urlA, nodeA);

    nodeB = startNode({
      port: portB,
      dataDir: path.join(root, "node-b"),
      nodeId: "bidirectional-b",
      peer: urlA,
      token
    });
    await waitForHealth(urlB, nodeB);

    const fromA = { id: "from-peer-a-001", data: "synthetic payload from independent peer A" };
    const writeA = await fetch(urlA + "/objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fromA)
    });
    assert.equal(writeA.status, 201);
    await waitForObject(urlB, fromA.id, fromA.data);

    const fromB = { id: "from-peer-b-001", data: "synthetic payload from independent peer B" };
    const writeB = await fetch(urlB + "/objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fromB)
    });
    assert.equal(writeB.status, 201);
    await waitForObject(urlA, fromB.id, fromB.data);
  } finally {
    if (nodeA) await stopNode(nodeA);
    if (nodeB) await stopNode(nodeB);
    await rm(root, { recursive: true, force: true });
  }
});
