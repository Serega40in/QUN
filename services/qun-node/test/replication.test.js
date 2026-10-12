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
  throw new Error("QUN Node health endpoint did not become ready");
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
      QUN_NODE_SHARED_TOKEN: token
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

test("replicates a synthetic object from node A to independent node B", { timeout: 15000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "qun-node-replication-"));
  const portA = await freePort();
  const portB = await freePort();
  const token = "qun-test-only-shared-token-please-change-001";
  let nodeB;
  let nodeA;
  try {
    nodeB = startNode({ port: portB, dataDir: path.join(root, "node-b"), nodeId: "node-b", token });
    await waitForHealth("http://127.0.0.1:" + portB, nodeB);

    nodeA = startNode({
      port: portA,
      dataDir: path.join(root, "node-a"),
      nodeId: "node-a",
      peers: "http://127.0.0.1:" + portB,
      token
    });
    await waitForHealth("http://127.0.0.1:" + portA, nodeA);

    const put = await fetch("http://127.0.0.1:" + portA + "/objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "replica-test-01", data: "synthetic QUN test object" })
    });
    assert.equal(put.status, 201);
    const result = await put.json();
    assert.equal(result.replication.succeeded, 1);

    const get = await fetch("http://127.0.0.1:" + portB + "/objects/replica-test-01");
    assert.equal(get.status, 200);
    const object = await get.json();
    assert.equal(object.data, "synthetic QUN test object");

    const verify = await fetch("http://127.0.0.1:" + portB + "/objects/replica-test-01/verify");
    assert.equal((await verify.json()).valid, true);
  } finally {
    if (nodeA) await stopNode(nodeA);
    if (nodeB) await stopNode(nodeB);
    await rm(root, { recursive: true, force: true });
  }
});