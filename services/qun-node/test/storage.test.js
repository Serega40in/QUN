import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LocalStorage, sha256 } from "../src/storage.js";

async function withStorage(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "qun-storage-test-"));
  const storage = new LocalStorage(dir, { maxObjectBytes: 1024 });
  await storage.init();
  try {
    await fn(storage, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("SHA-256 is deterministic", () => {
  assert.equal(sha256(Buffer.from("qun-test")), sha256(Buffer.from("qun-test")));
  assert.notEqual(sha256(Buffer.from("qun-test")), sha256(Buffer.from("qun-other")));
});

test("stores test object, manifest and verifies integrity", async () => {
  await withStorage(async storage => {
    const manifest = await storage.put("synthetic test data", "sample_01");
    assert.equal(manifest.objectId, "sample_01");
    assert.equal(manifest.sha256, sha256(Buffer.from("synthetic test data")));
    assert.equal((await storage.get("sample_01")).data.toString("utf8"), "synthetic test data");
    assert.equal((await storage.verify("sample_01")).valid, true);
  });
});

test("detects corrupted object bytes", async () => {
  await withStorage(async (storage, dir) => {
    await storage.put("synthetic test data", "corrupt_me");
    await writeFile(path.join(dir, "objects", "corrupt_me.bin"), "modified bytes");
    const result = await storage.verify("corrupt_me");
    assert.equal(result.valid, false);
    assert.notEqual(result.expectedSha256, result.actualSha256);
  });
});

test("rejects path traversal IDs", async () => {
  await withStorage(async storage => {
    await assert.rejects(() => storage.put("test", "../outside"), /Invalid object id/);
  });
});

test("enforces object size limit", async () => {
  await withStorage(async storage => {
    await assert.rejects(() => storage.put("x".repeat(1025), "too_big"), /size limit/);
  });
});