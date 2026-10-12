import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { LocalStorage } from "./storage.js";

const HOST = process.env.QUN_NODE_HOST || "127.0.0.1";
const PORT = Number(process.env.QUN_NODE_PORT || 8787);
const DATA_DIR = path.resolve(process.env.QUN_NODE_DATA_DIR || "./.qun-node-data");
const MAX_BODY_BYTES = 1024 * 1024;
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
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);