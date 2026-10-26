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

function startNode({ port, dataDir }) {
  return spawn(process.execPath, [path.join(process.cwd(), "src", "server.js")], {
    cwd: process.cwd(),
    stdio: ["ignore", "ignore", "pipe"],
    env: {
      ...process.env,
      QUN_NODE_HOST: "127.0.0.1",
      QUN_NODE_PORT: String(port),
      QUN_NODE_DATA_DIR: dataDir,
      QUN_NODE_PEERS: "",
      QUN_NODE_SHARED_TOKEN: ""
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

test("stored object and integrity manifest survive a full node restart", { timeout: 20000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "qun-node-persistence-"));
  const dataDir = path.join(root, "persistent-node-data");
  const port = await freePort();
  const base = "http://127.0.0.1:" + port;
  const objectId = "restart-persistence-01";
  const payload = "synthetic persistence check — QUN Node";
  let child;
  try {
    child = startNode({ port, dataDir });
    await waitForHealth(base, child);
    const put = await fetch(base + "/objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: objectId, data: payload })
    });
    assert.equal(put.status, 201);
    const stored = await put.json();
    assert.equal(stored.manifest.objectId, objectId);
    await stopNode(child);
    child = null;

    child = startNode({ port, dataDir });
    await waitForHealth(base, child);
    const read = await fetch(base + "/objects/" + objectId);
    assert.equal(read.status, 200);
    const restored = await read.json();
    assert.equal(restored.data, payload);
    assert.equal(restored.sha256, stored.manifest.sha256);

    const verify = await fetch(base + "/objects/" + objectId + "/verify");
    assert.equal(verify.status, 200);
    const integrity = await verify.json();
    assert.equal(integrity.valid, true);
    assert.equal(integrity.actualSha256, stored.manifest.sha256);
  } finally {
    if (child) await stopNode(child);
    await rm(root, { recursive: true, force: true });
  }
});

test("object API rejects path-like IDs without writing outside storage", { timeout: 15000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "qun-node-object-id-"));
  const dataDir = path.join(root, "node-data");
  const port = await freePort();
  const base = "http://127.0.0.1:" + port;
  let child;
  try {
    child = startNode({ port, dataDir });
    await waitForHealth(base, child);
    for (const id of ["../escape", "a/b", "..", "has space"]) {
      const response = await fetch(base + "/objects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, data: "must not be written" })
      });
      assert.equal(response.status, 400, "unsafe ID should be rejected: " + id);
    }
  } finally {
    if (child) await stopNode(child);
    await rm(root, { recursive: true, force: true });
  }
});
