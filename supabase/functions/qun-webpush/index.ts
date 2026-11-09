import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();
const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store"
};
const ALLOWED_PUSH_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  "web.push.samsung.com",
  "push.services.mozilla.com"
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
function asString(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}
async function hmacSha256(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
}
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  return await hmacSha256(salt, ikm);
}
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const pieces: Uint8Array[] = [];
  let previous = new Uint8Array(0);
  let total = 0;
  for (let counter = 1; total < length; counter++) {
    if (counter > 255) throw new Error("HKDF output length is invalid.");
    previous = await hmacSha256(prk, concatBytes(previous, info, new Uint8Array([counter])));
    pieces.push(previous);
    total += previous.length;
  }
  return concatBytes(...pieces).subarray(0, length);
}
function normalizeEcdsaSignature(signature: Uint8Array): Uint8Array {
  // WebCrypto normally returns the 64-byte IEEE-P1363 signature; tolerate DER implementations too.
  if (signature.length === 64) return signature;
  if (signature.length < 8 || signature[0] !== 0x30) throw new Error("Unexpected ECDSA signature format.");
  let cursor = 2;
  const readInteger = () => {
    if (signature[cursor++] !== 0x02) throw new Error("Unexpected ECDSA signature integer.");
    const len = signature[cursor++];
    let value = signature.subarray(cursor, cursor + len); cursor += len;
    while (value.length > 32 && value[0] === 0) value = value.subarray(1);
    if (value.length > 32) throw new Error("ECDSA signature integer is too large.");
    const result = new Uint8Array(32); result.set(value, 32 - value.length); return result;
  };
  return concatBytes(readInteger(), readInteger());
}
function validPushEndpoint(endpoint: string): URL | null {
  try {
    const url = new URL(endpoint);
    const hostAllowed = ALLOWED_PUSH_HOSTS.has(url.hostname) ||
      url.hostname.endsWith(".push.services.mozilla.com") ||
      url.hostname.endsWith(".push.apple.com");
    if (url.protocol !== "https:" || !hostAllowed || url.username || url.password) return null;
    return url;
  } catch { return null; }
}
async function ensureVapid(admin: ReturnType<typeof createClient>) {
  const load = async () => {
    const { data, error } = await admin.from("qun_webpush_config")
      .select("singleton,public_key,private_jwk").eq("singleton", true).maybeSingle();
    if (error) throw new Error("Could not read Web Push config: " + error.message);
    return data;
  };
  let current = await load();
  if (current) return current;

  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]
  ) as CryptoKeyPair;
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  if (!publicJwk.x || !publicJwk.y || !privateJwk.d) throw new Error("Unable to create VAPID key pair.");
  const publicRaw = concatBytes(new Uint8Array([4]), fromBase64Url(publicJwk.x), fromBase64Url(publicJwk.y));
  const publicKey = base64Url(publicRaw);
  const { error: insertError } = await admin.from("qun_webpush_config").insert({
    singleton: true, public_key: publicKey, private_jwk: privateJwk, updated_at: new Date().toISOString()
  });
  if (insertError && insertError.code !== "23505") {
    throw new Error("Could not store Web Push config: " + insertError.message);
  }
  current = await load();
  if (!current) throw new Error("Web Push config was not created.");
  return current;
}
async function createVapidAuthorization(endpoint: string, config: { public_key: string; private_jwk: JsonWebKey }) {
  const origin = new URL(endpoint).origin;
  const jwtHeader = base64Url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const jwtPayload = base64Url(encoder.encode(JSON.stringify({
    aud: origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: "https://quniverse.ru/"
  })));
  const signInput = encoder.encode(jwtHeader + "." + jwtPayload);
  const key = await crypto.subtle.importKey(
    "jwk", config.private_jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );
  const rawSignature = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key, signInput
  ));
  const token = jwtHeader + "." + jwtPayload + "." + base64Url(normalizeEcdsaSignature(rawSignature));
  return "vapid t=" + token + ", k=" + config.public_key;
}
async function encryptPushPayload(subscription: { p256dh: string; auth_key: string }, payload: unknown): Promise<Uint8Array> {
  const uaPublic = fromBase64Url(subscription.p256dh);
  const authSecret = fromBase64Url(subscription.auth_key);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4 || authSecret.length < 16) {
    throw new Error("Invalid Web Push subscription keys.");
  }
  const uaKey = await crypto.subtle.importKey(
    "raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const appPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  ) as CryptoKeyPair;
  const appPublic = new Uint8Array(await crypto.subtle.exportKey("raw", appPair.publicKey));
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaKey }, appPair.privateKey, 256
  ));

  const authPrk = await hkdfExtract(authSecret, sharedSecret);
  const keyInfo = concatBytes(encoder.encode("WebPush: info\0"), uaPublic, appPublic);
  const ikm = await hkdfExpand(authPrk, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prk, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk, encoder.encode("Content-Encoding: nonce\0"), 12);

  const recordHeader = concatBytes(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([appPublic.length]), appPublic);
  const message = concatBytes(encoder.encode(JSON.stringify(payload)), new Uint8Array([2]));
  if (message.length + recordHeader.length + 16 > 4096) throw new Error("Push payload is too large.");
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: recordHeader, tagLength: 128 }, aesKey, message
  ));
  return concatBytes(recordHeader, cipher);
}
async function sendOnePush(admin: ReturnType<typeof createClient>, subscription: any, payload: unknown, config: any) {
  const endpoint = validPushEndpoint(subscription.endpoint);
  if (!endpoint) return { ok: false, status: 0, reason: "unsupported_endpoint" };
  const body = await encryptPushPayload(subscription, payload);
  const authorization = await createVapidAuthorization(endpoint.href, config);
  const res = await fetch(endpoint.href, {
    method: "POST",
    headers: {
      "Authorization": authorization,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "60",
      "Urgency": "high"
    },
    body,
    signal: AbortSignal.timeout(6500)
  });
  if (res.status === 404 || res.status === 410) {
    await admin.from("qun_push_subscriptions").delete().eq("id", subscription.id);
  }
  return { ok: res.ok, status: res.status, reason: res.ok ? "" : "push_service_rejected" };
}
async function dispatchCallPushes(admin: ReturnType<typeof createClient>, subscriptions: any[], config: any, payload: unknown) {
  const results = await Promise.all(subscriptions.map(async (subscription) => {
    try { return await sendOnePush(admin, subscription, payload, config); }
    catch (error) {
      console.warn("QUN push delivery failed:", error instanceof Error ? error.message : String(error));
      return { ok: false, status: 0, reason: "delivery_error" };
    }
  }));
  console.info("QUN call push delivery results:", JSON.stringify({
    count: results.length, delivered: results.filter((r) => r.ok).length,
    expired: results.filter((r) => r.status === 404 || r.status === 410).length
  }));
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed." }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return response({ error: "Sign in to QUN first." }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("QUN Web Push is missing required Supabase environment variables.");
      return response({ error: "Push service is not configured on the server." }, 503);
    }
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } }
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    const user = authData?.user;
    if (authError || !user) return response({ error: "Your QUN session has expired. Sign in again." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const body = await req.json().catch(() => ({}));
    const action = asString(body?.action, 40);

    if (action === "public_key") {
      const config = await ensureVapid(admin);
      return response({ publicKey: config.public_key });
    }

    if (action === "subscribe") {
      const subscription = body?.subscription;
      const endpoint = asString(subscription?.endpoint, 2048);
      const url = validPushEndpoint(endpoint);
      const p256dh = asString(subscription?.keys?.p256dh, 256);
      const authKey = asString(subscription?.keys?.auth, 256);
      if (!url || !p256dh || !authKey) return response({ error: "Invalid or unsupported push subscription." }, 400);
      const pub = fromBase64Url(p256dh);
      const auth = fromBase64Url(authKey);
      if (pub.length !== 65 || pub[0] !== 4 || auth.length < 16) {
        return response({ error: "The browser returned invalid push keys." }, 400);
      }
      const { error } = await admin.from("qun_push_subscriptions").upsert({
        user_id: user.id,
        endpoint: url.href,
        p256dh,
        auth_key: authKey,
        user_agent: asString(req.headers.get("user-agent"), 300),
        updated_at: new Date().toISOString()
      }, { onConflict: "endpoint" });
      if (error) {
        console.error("QUN subscription save failed:", error.message);
        return response({ error: "Could not save this device's notification settings." }, 500);
      }
      return response({ ok: true });
    }

    if (action === "unsubscribe") {
      const endpoint = asString(body?.endpoint, 2048);
      const url = validPushEndpoint(endpoint);
      if (!url) return response({ error: "Invalid push endpoint." }, 400);
      const { error } = await admin.from("qun_push_subscriptions")
        .delete().eq("user_id", user.id).eq("endpoint", url.href);
      if (error) return response({ error: "Could not remove this device." }, 500);
      return response({ ok: true });
    }

    if (action === "create_call") {
      const conversationId = asString(body?.conversationId, 64);
      const toUserId = asString(body?.toUserId, 64);
      const mode = body?.mode === "video" ? "video" : body?.mode === "audio" ? "audio" : "";
      const offer = body?.offer;
      if (!UUID_RE.test(conversationId) || !UUID_RE.test(toUserId) || toUserId === user.id ||
          !mode || offer?.type !== "offer" || typeof offer?.sdp !== "string" || offer.sdp.length < 20 || offer.sdp.length > 24000) {
        return response({ error: "Invalid call invitation." }, 400);
      }
      const { data: members, error: memberError } = await admin.from("conversation_members")
        .select("user_id").eq("conversation_id", conversationId).in("user_id", [user.id, toUserId]);
      if (memberError) return response({ error: "Could not verify conversation membership." }, 500);
      const memberSet = new Set((members || []).map((row: any) => row.user_id));
      if (!memberSet.has(user.id) || !memberSet.has(toUserId)) {
        return response({ error: "Only conversation members can send a call invitation." }, 403);
      }
      const expiry = new Date(Date.now() + 90_000).toISOString();
      const { data: invite, error: inviteError } = await admin.from("qun_call_invites").insert({
        conversation_id: conversationId,
        from_user_id: user.id,
        to_user_id: toUserId,
        mode,
        offer,
        status: "pending",
        expires_at: expiry
      }).select("id,conversation_id,from_user_id,to_user_id,mode").single();
      if (inviteError || !invite) {
        console.error("QUN call invite save failed:", inviteError?.message);
        return response({ error: "Could not prepare a background-call invitation." }, 500);
      }

      const { data: subscriptions, error: subsError } = await admin.from("qun_push_subscriptions")
        .select("id,endpoint,p256dh,auth_key").eq("user_id", toUserId);
      if (subsError) {
        console.warn("QUN subscriptions could not be loaded:", subsError.message);
        return response({ callId: invite.id, pushScheduled: false, warning: "push_subscriptions_unavailable" });
      }
      if (subscriptions?.length) {
        const config = await ensureVapid(admin);
        const { data: profile } = await admin.from("profiles").select("display_name,username")
          .eq("id", user.id).maybeSingle();
        const callerName = asString(profile?.display_name || profile?.username || "Контакт QUN", 48);
        const pushPayload = {
          type: "call",
          title: "Входящий звонок · QUN",
          body: callerName + (mode === "video" ? " звонит по видео" : " звонит вам"),
          tag: "qun-call-" + invite.id,
          url: "./?callId=" + encodeURIComponent(invite.id),
          callId: invite.id,
          conversationId: invite.conversation_id,
          fromUserId: invite.from_user_id,
          mode
        };
        const pushTask = dispatchCallPushes(admin, subscriptions, config, pushPayload);
        const runtime = (globalThis as any).EdgeRuntime;
        if (runtime && typeof runtime.waitUntil === "function") runtime.waitUntil(pushTask);
        else await pushTask;
        return response({ callId: invite.id, pushScheduled: true, deviceCount: subscriptions.length });
      }
      return response({ callId: invite.id, pushScheduled: false, deviceCount: 0 });
    }

    if (action === "get_incoming_calls") {
      const callId = asString(body?.callId, 64);
      if (callId && !UUID_RE.test(callId)) return response({ error: "Invalid call invitation id." }, 400);
      let query = admin.from("qun_call_invites")
        .select("id,conversation_id,from_user_id,mode,offer,status,created_at,expires_at")
        .eq("to_user_id", user.id).eq("status", "pending").gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(5);
      if (callId) query = query.eq("id", callId);
      const { data, error } = await query;
      if (error) return response({ error: "Could not load incoming calls." }, 500);
      return response({ calls: data || [] });
    }

    if (action === "update_call") {
      const callId = asString(body?.callId, 64);
      const nextStatus = asString(body?.status, 20);
      if (!UUID_RE.test(callId) || !["accepted", "rejected", "ended"].includes(nextStatus)) {
        return response({ error: "Invalid call status update." }, 400);
      }
      const { data: invite, error: lookupError } = await admin.from("qun_call_invites")
        .select("id,from_user_id,to_user_id,status").eq("id", callId).maybeSingle();
      if (lookupError) return response({ error: "Could not verify call invitation." }, 500);
      if (!invite) return response({ error: "Call invitation not found." }, 404);
      const recipient = invite.to_user_id === user.id;
      const caller = invite.from_user_id === user.id;
      if (!recipient && !caller) return response({ error: "You are not part of this call." }, 403);
      if ((nextStatus === "accepted" || nextStatus === "rejected") && (!recipient || invite.status !== "pending")) {
        return response({ error: "This invitation is no longer pending." }, 409);
      }
      if (nextStatus === "ended" && !["pending", "accepted"].includes(invite.status)) {
        return response({ ok: true, status: invite.status });
      }
      const { error: updateError } = await admin.from("qun_call_invites")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", callId).eq("status", invite.status);
      if (updateError) return response({ error: "Could not update call status." }, 500);
      return response({ ok: true, status: nextStatus });
    }

    return response({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("QUN Web Push request failed:", error instanceof Error ? error.message : String(error));
    return response({ error: "The notification service encountered an error." }, 500);
  }
});
