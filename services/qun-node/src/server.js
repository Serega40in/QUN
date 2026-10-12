import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { LocalStorage, sha256 } from "./storage.js";

const HOST = process.env.QUN_NODE_HOST || "127.0.0.1";
const PORT = Number(process.env.QUN_NODE_PORT || 8787);
const DATA_DIR = path.resolve(process.env.QUN_NODE_DATA_DIR || "./.qun-node-data");
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const PEERS = (process.env.QUN_NODE_PEERS || "").split(",").map(v => v.trim().replace(/\/$/, "")).filter(Boolean);
const SHARED_TOKEN = process.env.QUN_NODE_SHARED_TOKEN || "";

const storage = new LocalStorage(DATA_DIR);
await storage.init();

function tokenMatches(req) {
  const supplied = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!SHARED_TOKEN || supplied.length !== SHARED_TOKEN.length) return false;
  try { return timingSafeEqual(Buffer.from(supplied), Buffer.from(SHARED_TOKEN)); } catch { return false; }
}

async function replicateToPeers(id, data) {
  if (!PEERS.length) return [];
  if (SHARED_TOKEN.length < 32) return PEERS.map(peer => ({ peer, ok: false, error: "Replication disabled: configure a shared token of at least 32 characters." }));
  return await Promise.all(PEERS.map(async peer => {
    try {
      const parsed = new URL(peer);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported peer protocol");
      const response = await fetch(peer + "/internal/replicas", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SHARED_TOKEN },
        body: JSON.stringify({ id, data }),
        signal: AbortSignal.timeout(5000)
      });
      const result = await response.json().catch(() => ({}));
      return response.ok ? { peer, ok: true, status: response.status, sha256: result.manifest?.sha256 || result.sha256 || null } : { peer, ok: false, status: response.status, error: result.error || "Peer rejected replica" };
    } catch (error) {
      return { peer, ok: false, error: error instanceof Error ? error.message : "Peer unavailable" };
    }
  }));
}

async function reconcilePeer(peer) {
  if (SHARED_TOKEN.length < 32) return { peer, ok: false, error: "Replication disabled: configure a shared token of at least 32 characters." };
  const headers = { "Authorization": "Bearer " + SHARED_TOKEN };
  const listResponse = await fetch(peer + "/internal/replicas/manifests", { headers, signal: AbortSignal.timeout(5000) });
  if (!listResponse.ok) throw new Error("Peer manifest request returned HTTP " + listResponse.status);
  const peerManifests = (await listResponse.json()).manifests;
  if (!Array.isArray(peerManifests)) throw new Error("Peer returned an invalid manifest list");
  let repairedFromPeer = 0;
  let sentToPeer = 0;
  let conflicts = 0;

  for (const remoteManifest of peerManifests) {
    if (!remoteManifest || typeof remoteManifest.objectId !== "string") continue;
    let local = null;
    try { local = await storage.verify(remoteManifest.objectId); } catch {}
    if (local?.valid) {
      if (local.actualSha256 !== remoteManifest.sha256) conflicts++;
      continue;
    }
    const objectResponse = await fetch(peer + "/internal/replicas/" + encodeURIComponent(remoteManifest.objectId), {
      headers, signal: AbortSignal.timeout(5000)
    });
    if (!objectResponse.ok) continue;
    const remote = await objectResponse.json();
    if (typeof remote.data !== "string" || !remote.manifest) continue;
    const bytes = Buffer.from(remote.data, "utf8");
    if (sha256(bytes) !== remote.manifest.sha256 || bytes.length !== remote.manifest.sizeBytes) continue;
    if (remote.manifest.objectId !== remoteManifest.objectId) continue;
    await storage.put(remote.data, remoteManifest.objectId);
    repairedFromPeer++;
  }

  for (const localManifest of await storage.listManifests()) {
    try {
      const local = await storage.verify(localManifest.objectId);
      if (!local.valid) continue;
      const data = (await storage.get(localManifest.objectId)).data.toString("utf8");
      const response = await fetch(peer + "/internal/replicas", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id: localManifest.objectId, data }),
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) sentToPeer++;
      else if (response.status === 409) conflicts++;
    } catch {}
  }
  return { peer, ok: true, repairedFromPeer, sentToPeer, conflicts, checkedAt: new Date().toISOString() };
}

let reconciliationRunning = false;
let lastReconciliation = null;
async function reconcileAllPeers() {
  if (reconciliationRunning || PEERS.length === 0) return;
  reconciliationRunning = true;
  try {
    const peers = await Promise.all(PEERS.map(async peer => {
      try { return await reconcilePeer(peer); }
      catch (error) { return { peer, ok: false, error: error instanceof Error ? error.message : "Peer unavailable", checkedAt: new Date().toISOString() }; }
    }));
    lastReconciliation = { checkedAt: new Date().toISOString(), peers };
  } finally {
    reconciliationRunning = false;
  }
}

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw Object.assign(new Error("Request body too large"), { statusCode: 413 });
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Expected a valid JSON body"), { statusCode: 400 });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      const storageStats = await storage.stats();
      return send(res, 200, {
        service: "qun-node",
        version: "0.1.0",
        status: "ok",
        mode: "local-test-only",
        nodeId: process.env.QUN_NODE_ID || "local-dev-node",
        platform: os.platform(),
        storage: storageStats,
        peerCount: PEERS.length,
        replicationEnabled: PEERS.length > 0 && SHARED_TOKEN.length >= 32,
        reconciliation: lastReconciliation,
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === "POST" && url.pathname === "/objects") {
      const body = await readJson(req);
      if (typeof body.data !== "string") {
        return send(res, 400, { error: "Field 'data' must be a UTF-8 string. Use synthetic test data only." });
      }
      const manifest = await storage.put(body.data, body.id || randomUUID());
      const replicas = await replicateToPeers(manifest.objectId, body.data);
      return send(res, 201, { manifest, replication: { configuredPeers: PEERS.length, succeeded: replicas.filter(r => r.ok).length, peers: replicas } });
    }

    if (req.method === "GET" && url.pathname === "/internal/replicas/manifests") {
      if (!tokenMatches(req)) return send(res, 401, { error: "Unauthorized peer replication request" });
      return send(res, 200, { manifests: await storage.listManifests() });
    }

    const internalObjectMatch = url.pathname.match(/^\\/internal\\/replicas\\/([a-zA-Z0-9_-]{1,80})$/);
    if (req.method === "GET" && internalObjectMatch) {
      if (!tokenMatches(req)) return send(res, 401, { error: "Unauthorized peer replication request" });
      const id = internalObjectMatch[1];
      const verification = await storage.verify(id);
      if (!verification.valid) return send(res, 409, { error: "Peer object failed integrity verification" });
      const [object, manifest] = await Promise.all([storage.get(id), storage.readManifest(id)]);
      return send(res, 200, { data: object.data.toString("utf8"), manifest });
    }

    if (req.method === "POST" && url.pathname === "/internal/replicas") {
      if (!tokenMatches(req)) return send(res, 401, { error: "Unauthorized peer replication request" });
      const body = await readJson(req);
      if (typeof body.data !== "string" || typeof body.id !== "string") {
        return send(res, 400, { error: "Expected object id and UTF-8 test data" });
      }
      const incomingHash = sha256(Buffer.from(body.data, "utf8"));
      try {
        const existing = await storage.verify(body.id);
        if (existing.valid && existing.actualSha256 === incomingHash) {
          return send(res, 200, { alreadyPresent: true, sha256: existing.actualSha256 });
        }
        if (existing.valid && existing.actualSha256 !== incomingHash) {
          return send(res, 409, { error: "Object ID already exists with different valid content" });
        }
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      const manifest = await storage.put(body.data, body.id);
      return send(res, 201, { manifest });
    }

    const objectMatch = url.pathname.match(/^\/objects\/([a-zA-Z0-9_-]{1,80})(?:\/(verify|manifest))?$/);
    if (objectMatch && req.method === "GET") {
      const [, id, action] = objectMatch;
      if (action === "verify") return send(res, 200, await storage.verify(id));
      if (action === "manifest") return send(res, 200, await storage.readManifest(id));
      const result = await storage.get(id);
      return send(res, 200, { objectId: id, data: result.data.toString("utf8"), sha256: result.sha256 });
    }

    return send(res, 404, { error: "Not found" });
  } catch (error) {
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : (error?.code === "ENOENT" ? 404 : 500);
    if (status >= 500) console.error("QUN Node request failed:", error instanceof Error ? error.message : "unknown error");
    return send(res, status, { error: status >= 500 ? "Internal node error" : error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`QUN Node 0.1 listening on http://${HOST}:${PORT}`);
  console.log(`Test storage directory: ${DATA_DIR}`);
  console.log("WARNING: local test prototype; do not store private or production data.");
  void reconcileAllPeers();
});
const reconcileTimer = setInterval(() => { void reconcileAllPeers(); }, Number(process.env.QUN_NODE_RECONCILE_INTERVAL_MS || 5000));
reconcileTimer.unref();

function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);