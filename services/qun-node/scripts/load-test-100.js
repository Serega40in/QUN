import { createHash, randomUUID } from "node:crypto";
import os from "node:os";

const base = new URL(process.argv[2] || "http://127.0.0.1:8787");
const local = ["localhost", "127.0.0.1", "::1"].includes(base.hostname.replace(/^\[|\]$/g, ""));
if (!local && process.env.QUN_NODE_LOAD_ALLOW_REMOTE !== "1") {
  throw new Error("Load test is loopback-only by default. Set QUN_NODE_LOAD_ALLOW_REMOTE=1 only for a dedicated, authorized test environment.");
}
const clients = Math.max(1, Math.min(1000, Number(process.env.QUN_LOAD_CLIENTS || 100)));
const concurrency = Math.max(1, Math.min(50, Number(process.env.QUN_LOAD_CONCURRENCY || 10)));
const rounds = Math.max(1, Math.min(5, Number(process.env.QUN_LOAD_ROUNDS || 1)));
const runId = randomUUID().replaceAll("-", "").slice(0, 12);
const timings = [];
const failures = [];
let completed = 0;
const digest = value => createHash("sha256").update(value).digest("hex");

async function request(path, options = {}) {
  const start = performance.now();
  const response = await fetch(new URL(path, base), { ...options, signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  timings.push(performance.now() - start);
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path}: HTTP ${response.status} ${typeof data === "string" ? data.slice(0, 120) : JSON.stringify(data)}`);
  return data;
}

const initial = await request("/health");
if (initial.mode !== "local-test-only") throw new Error("Target does not identify as a local-test-only QUN Node; refusing to run.");
console.log(`QUN Node synthetic load test: ${clients} virtual clients, concurrency ${concurrency}, rounds ${rounds}`);
console.log(`Target: ${base.origin}; host OS: ${os.platform()}; existing objects: ${initial.storage?.objects ?? "unknown"}`);

const jobs = [];
for (let round = 0; round < rounds; round++) {
  for (let client = 0; client < clients; client++) jobs.push({ round, client });
}
let next = 0;
async function worker() {
  while (true) {
    const index = next++;
    if (index >= jobs.length) return;
    const { round, client } = jobs[index];
    const id = `load_${runId}_r${round}_c${client}`;
    const payload = `QUN synthetic load-test data | run=${runId} | round=${round} | client=${client} | ${"x".repeat(768)}`;
    try {
      const created = await request("/objects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, data: payload })
      });
      if (created.manifest?.sha256 !== digest(payload)) throw new Error(`hash mismatch after write: ${id}`);
      const verified = await request(`/objects/${id}/verify`);
      if (verified.valid !== true) throw new Error(`integrity verification failed: ${id}`);
      const read = await request(`/objects/${id}`);
      if (read.data !== payload || read.sha256 !== digest(payload)) throw new Error(`read-back mismatch: ${id}`);
      completed++;
    } catch (error) {
      failures.push({ id, error: error instanceof Error ? error.message : String(error) });
    }
  }
}
const started = performance.now();
await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()));
const durationMs = performance.now() - started;
const finalHealth = await request("/health");
const sorted = [...timings].sort((a, b) => a - b);
const percentile = p => sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] * 100) / 100 : null;
const result = {
  target: base.origin,
  testMode: initial.mode,
  virtualClients: clients,
  concurrency,
  rounds,
  requestedClientRounds: jobs.length,
  completedClientRounds: completed,
  failures: failures.length,
  durationSeconds: Math.round(durationMs / 10) / 100,
  operations: timings.length,
  latencyMs: { p50: percentile(.5), p95: percentile(.95), p99: percentile(.99) },
  finalIntegrity: finalHealth.integrity,
  sampleFailures: failures.slice(0, 10),
  note: "Synthetic localhost test only; not evidence of 100 physical devices, geographic resilience, production capacity, or token-reward correctness. Objects are retained for inspection."
};
console.log(JSON.stringify(result, null, 2));
if (failures.length || finalHealth.integrity?.ok === false) process.exitCode = 1;
