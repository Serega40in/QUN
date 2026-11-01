import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}")["default"];
if (!SERVICE_KEY) throw new Error("Missing Supabase server-side key");
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, authorization, x-client-info, x-supabase-api-version",
  "Vary": "Origin"
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, "0")).join("");
}
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(x => x.toString(16).padStart(2, "0")).join("");
}
async function authorizeNode(body: Record<string, unknown>) {
  const nodeId = typeof body.nodeId === "string" ? body.nodeId : "";
  const token = typeof body.nodeToken === "string" ? body.nodeToken : "";
  if (!nodeId || token.length !== 64) return null;
  const { data: node, error } = await db.from("qun_nodes")
    .select("node_id,token_hash,revoked_at").eq("node_id", nodeId).maybeSingle();
  if (error || !node || node.revoked_at || node.token_hash !== await hash(token)) return null;
  return node.node_id as string;
}

async function authenticatedUser(req: Request) {
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\\s+/i, "");
  if (!bearer) return null;
  const { data, error } = await db.auth.getUser(bearer);
  return error ? null : data.user || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = body.action;
  try {
    if (action === "create_enrollment") {
      const user = await authenticatedUser(req);
      if (!user) return json({ error: "Войдите в QUN, чтобы создать код подключения." }, 401);
      await db.from("qun_node_enrollment_codes").delete()
        .eq("owner_id", user.id).is("used_at", null).lt("expires_at", new Date().toISOString());
      const { count, error: countError } = await db.from("qun_node_enrollment_codes")
        .select("code_hash", { count: "exact", head: true })
        .eq("owner_id", user.id).is("used_at", null).gt("expires_at", new Date().toISOString());
      if (countError) return json({ error: "Could not check active enrollment codes." }, 500);
      if ((count || 0) >= 5) return json({ error: "У тебя уже есть 5 активных кодов. Используй или дождись истечения существующего." }, 429);
      const enrollmentCode = randomToken();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const { error } = await db.from("qun_node_enrollment_codes").insert({
        code_hash: await hash(enrollmentCode),
        owner_id: user.id,
        expires_at: expiresAt
      });
      if (error) return json({ error: "Не удалось создать код подключения." }, 500);
      return json({ enrollmentCode, expiresAt, ttlSeconds: 900 });
    }
    if (action === "my_nodes") {
      const user = await authenticatedUser(req);
      if (!user) return json({ error: "Sign-in required" }, 401);
      const { data, error } = await db.from("qun_nodes")
        .select("node_id,node_name,platform,registered_at,last_seen_at,revoked_at")
        .eq("owner_id", user.id).is("revoked_at", null)
        .order("registered_at", { ascending: false }).limit(50);
      if (error) return json({ error: "Node status unavailable" }, 500);
      const now = Date.now();
      const nodes = (data || []).map(n => {
        const seen = n.last_seen_at ? Date.parse(n.last_seen_at) : 0;
        return { nodeId: n.node_id, name: n.node_name, platform: n.platform,
          registeredAt: n.registered_at, lastSeenAt: n.last_seen_at,
          status: seen && now - seen <= 90000 ? "online" : seen && now - seen <= 300000 ? "stale" : "offline" };
      });
      return json({ nodes, serverTime: new Date(now).toISOString(), online: nodes.filter(n => n.status === "online").length });
    }
    if (action === "register") {
      const code = typeof body.enrollmentCode === "string" ? body.enrollmentCode.trim() : "";
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
      const platform = typeof body.platform === "string" ? body.platform.trim().slice(0, 40) : "unknown";
      if (code.length < 20 || !name || !platform) return json({ error: "Enrollment code, node name and platform are required" }, 400);
      const nodeToken = randomToken();
      const { data, error } = await db.rpc("qun_register_node", {
        p_code_hash: await hash(code), p_node_name: name, p_platform: platform, p_token_hash: await hash(nodeToken)
      });
      if (error || !data?.[0]) return json({ error: "Registration rejected: code invalid, expired, or already used" }, 403);
      return json({ nodeId: data[0].node_id, nodeToken, registeredAt: data[0].registered_at });
    }
    if (action === "heartbeat") {
      const nodeId = typeof body.nodeId === "string" ? body.nodeId : "";
      const token = typeof body.nodeToken === "string" ? body.nodeToken : "";
      if (!nodeId || token.length !== 64) return json({ error: "Node ID and token required" }, 400);
      const tokenHash = await hash(token);
      const { data: node, error: readError } = await db.from("qun_nodes")
        .select("node_id,token_hash,revoked_at").eq("node_id", nodeId).maybeSingle();
      if (readError || !node || node.revoked_at || node.token_hash !== tokenHash) return json({ error: "Unauthorized node" }, 401);
      const now = new Date().toISOString();
      const { error } = await db.from("qun_nodes").update({ last_seen_at: now }).eq("node_id", nodeId);
      if (error) return json({ error: "Heartbeat could not be stored" }, 500);
      return json({ ok: true, nodeId, serverTime: now, heartbeatIntervalSeconds: 30 });
    }
    if (action === "status") {
      const { data, error } = await db.from("qun_nodes")
        .select("node_id,node_name,platform,registered_at,last_seen_at,revoked_at")
        .order("registered_at", { ascending: false }).limit(100);
      if (error) return json({ error: "Node status unavailable" }, 500);
      const now = Date.now();
      const nodes = (data || []).filter(n => !n.revoked_at).map(n => {
        const seen = n.last_seen_at ? Date.parse(n.last_seen_at) : 0;
        return { nodeId: n.node_id, name: n.node_name, platform: n.platform,
          registeredAt: n.registered_at, lastSeenAt: n.last_seen_at,
          status: seen && now - seen <= 90000 ? "online" : seen && now - seen <= 300000 ? "stale" : "offline" };
      });
      return json({ nodes, serverTime: new Date(now).toISOString(), online: nodes.filter(n => n.status === "online").length });
    }
    if (["upload_test_object", "poll_test_object", "ack_test_object", "test_transfer_status"].includes(String(action))) {
      const nodeId = await authorizeNode(body);
      if (!nodeId) return json({ error: "Unauthorized node" }, 401);
      if (action === "upload_test_object") {
        const targetNodeId = typeof body.targetNodeId === "string" ? body.targetNodeId : "";
        const objectId = typeof body.objectId === "string" ? body.objectId : "";
        const payload = typeof body.payload === "string" ? body.payload : "";
        const digest = typeof body.sha256 === "string" ? body.sha256 : "";
        const sizeBytes = new TextEncoder().encode(payload).length;
        if (!targetNodeId || targetNodeId === nodeId || !/^[a-zA-Z0-9_-]{1,80}$/.test(objectId)) return json({ error: "A different target node and valid object ID are required" }, 400);
        if (sizeBytes > 262144) return json({ error: "Synthetic test file is limited to 256 KiB" }, 413);
        if (await hash(payload) !== digest) return json({ error: "Source SHA-256 does not match payload" }, 400);
        const { data: target, error: targetError } = await db.from("qun_nodes").select("node_id,revoked_at").eq("node_id", targetNodeId).maybeSingle();
        if (targetError || !target || target.revoked_at) return json({ error: "Target node not found" }, 404);
        await db.from("qun_node_test_transfers").delete().lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        const { data, error } = await db.from("qun_node_test_transfers").insert({
          source_node_id: nodeId, target_node_id: targetNodeId, object_id: objectId, payload,
          sha256: digest, size_bytes: sizeBytes, status: "pending"
        }).select("transfer_id,object_id,sha256,size_bytes,created_at,status").single();
        if (error || !data) return json({ error: "Could not queue test transfer" }, 500);
        return json({ transfer: data }, 201);
      }
      if (action === "poll_test_object") {
        const { data, error } = await db.from("qun_node_test_transfers")
          .select("transfer_id,source_node_id,object_id,payload,sha256,size_bytes,created_at")
          .eq("target_node_id", nodeId).eq("status", "pending").order("created_at", { ascending: true }).limit(1);
        if (error) return json({ error: "Could not poll test transfers" }, 500);
        return json({ transfer: data?.[0] || null });
      }
      if (action === "ack_test_object") {
        const transferId = typeof body.transferId === "string" ? body.transferId : "";
        const receivedSha256 = typeof body.receivedSha256 === "string" ? body.receivedSha256 : "";
        if (!transferId || !/^[a-f0-9]{64}$/.test(receivedSha256)) return json({ error: "Transfer ID and received SHA-256 are required" }, 400);
        const { data: transfer, error: readError } = await db.from("qun_node_test_transfers")
          .select("transfer_id,target_node_id,sha256,status").eq("transfer_id", transferId).maybeSingle();
        if (readError || !transfer || transfer.target_node_id !== nodeId) return json({ error: "Transfer not found for this node" }, 404);
        const status = receivedSha256 === transfer.sha256 ? "verified" : "mismatch";
        const { error } = await db.from("qun_node_test_transfers").update({
          status, received_sha256: receivedSha256, received_at: new Date().toISOString(),
          ...(status === "verified" ? { payload: "" } : {})
        }).eq("transfer_id", transferId).eq("target_node_id", nodeId);
        if (error) return json({ error: "Could not store integrity result" }, 500);
        return json({ ok: status === "verified", status, expectedSha256: transfer.sha256, receivedSha256 });
      }
      if (action === "test_transfer_status") {
        const transferId = typeof body.transferId === "string" ? body.transferId : "";
        const { data, error } = await db.from("qun_node_test_transfers")
          .select("transfer_id,source_node_id,target_node_id,object_id,sha256,size_bytes,status,created_at,received_at,received_sha256")
          .eq("transfer_id", transferId).maybeSingle();
        if (error || !data || data.source_node_id !== nodeId) return json({ error: "Transfer not found" }, 404);
        return json({ transfer: data });
      }
    }
    return json({ error: "Unknown action" }, 400);
  } catch {
    return json({ error: "Registry request failed" }, 500);
  }
});
