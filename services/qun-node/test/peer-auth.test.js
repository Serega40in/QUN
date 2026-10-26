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

test("peer replication reads and writes require the correct shared secret", { timeout: 15000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "qun-node-auth-"));
  const port = await freePort();
  const token = "qun-test-peer-auth-token-32-chars-minimum-001";
  const base = "http://127.0.0.1:" + port;
  const child = spawn(process.execPath, [path.join(process.cwd(), "src", "server.js")], {
    cwd: process.cwd(),
    stdio: ["ignore", "ignore", "pipe"],
    env: {
      ...process.env,
      QUN_NODE_HOST: "127.0.0.1",
      QUN_NODE_PORT: String(port),
      QUN_NODE_DATA_DIR: path.join(root, "node"),
      QUN_NODE_ID: "auth-test-node",
      QUN_NODE_PEERS: "",
      QUN_NODE_SHARED_TOKEN: token
    }
  });
  try {
    await waitForHealth(base, child);
    const objectId = "auth-check-object";
    const body = JSON.stringify({ id: objectId, data: "synthetic authorized peer payload" });

    for (const headers of [{}, { Authorization: "Bearer definitely-not-the-secret" }]) {
      const missingOrWrongList = await fetch(base + "/internal/replicas/manifests", { headers });
      assert.equal(missingOrWrongList.status, 401);

      const missingOrWrongWrite = await fetch(base + "/internal/replicas", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body
      });
      assert.equal(missingOrWrongWrite.status, 401);

      const missingOrWrongRead = await fetch(base + "/internal/replicas/" + objectId, { headers });
      assert.equal(missingOrWrongRead.status, 401);
    }

    const authorizedWrite = await fetch(base + "/internal/replicas", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body
    });
    assert.equal(authorizedWrite.status, 201);

    const authorizedList = await fetch(base + "/internal/replicas/manifests", {
      headers: { Authorization: "Bearer " + token }
    });
    assert.equal(authorizedList.status, 200);
    const listed = await authorizedList.json();
    assert.equal(listed.manifests.length, 1);
    assert.equal(listed.manifests[0].objectId, objectId);

    const authorizedRead = await fetch(base + "/internal/replicas/" + objectId, {
      headers: { Authorization: "Bearer " + token }
    });
    assert.equal(authorizedRead.status, 200);
    const replica = await authorizedRead.json();
    assert.equal(replica.data, "synthetic authorized peer payload");
    assert.equal(replica.manifest.objectId, objectId);
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([
        new Promise(resolve => child.once("exit", resolve)),
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
    await rm(root, { recursive: true, force: true });
  }
});
