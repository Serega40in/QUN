export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ALLOWED_ORIGIN?: string;
}

type AuthUser = { id: string; email?: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> };
type JsonRpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };

const SERVICES = [
  { id: "qun-id", name: "QUN ID", status: "existing-service", description: "Identity and authentication foundation. Access depends on the user's Supabase session and policies." },
  { id: "qun-messenger", name: "QUN Messenger", status: "existing-service", description: "Messaging application; no general-purpose public messaging API is exposed by this MVP." },
  { id: "qun-market", name: "QUN Market", status: "existing-service", description: "Marketplace application; production commerce operations are not exposed by this MVP." },
  { id: "qun-node", name: "QUN Node", status: "existing-service", description: "Distributed node infrastructure; node operations are not exposed by this MVP." },
  { id: "qun-storage", name: "QUN Storage", status: "in-development", description: "Distributed storage workstream; no public storage API is exposed by this MVP." },
  { id: "qun-ai", name: "QUN AI", status: "existing-service", description: "AI assistant application." }
];

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}
function cors(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGIN;
  return {
    "access-control-allow-origin": allowed ? (origin === allowed ? allowed : "null") : "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type, Mcp-Session-Id, MCP-Protocol-Version",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}
function bearer(request: Request) {
  const value = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1] ?? null;
}
async function authenticate(request: Request, env: Env): Promise<{ user: AuthUser; accessToken: string } | Response> {
  const accessToken = bearer(request);
  if (!accessToken) return json({ error: { code: "unauthorized", message: "Bearer access token required." } }, 401);
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return json({ error: { code: "server_misconfigured", message: "Supabase environment is not configured." } }, 503);
  }
  try {
    const response = await fetch(new URL("/auth/v1/user", env.SUPABASE_URL), {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) return json({ error: { code: "unauthorized", message: "Access token is invalid or expired." } }, 401);
    const user = await response.json() as AuthUser;
    if (!user?.id) return json({ error: { code: "unauthorized", message: "Supabase did not return a user." } }, 401);
    return { user, accessToken };
  } catch {
    return json({ error: { code: "auth_upstream_unavailable", message: "Unable to validate session with Supabase Auth." } }, 502);
  }
}
async function getProfile(user: AuthUser, accessToken: string, env: Env) {
  const url = new URL("/rest/v1/profiles", env.SUPABASE_URL);
  url.searchParams.set("select", "id,username,display_name,avatar_url,created_at");
  url.searchParams.set("id", `eq.${user.id}`);
  const response = await fetch(url, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error("profile_lookup_failed");
  const rows = await response.json() as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}
async function currentUser(request: Request, env: Env) {
  const result = await authenticate(request, env);
  if (result instanceof Response) return result;
  try {
    const profile = await getProfile(result.user, result.accessToken, env);
    return json({
      data: {
        id: result.user.id,
        email: result.user.email ?? null,
        profile,
        capabilities: ["qun:services:read", "qun:identity:read"]
      }
    });
  } catch {
    return json({ error: { code: "profile_unavailable", message: "Authenticated, but profile lookup failed. Check the profiles RLS policy and schema." } }, 502);
  }
}
function toolResult(value: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value, isError: false };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}
async function handleMcp(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "MCP endpoint accepts JSON-RPC POST requests. Use an MCP client." }, 405, { allow: "POST, OPTIONS" });
  let rpc: JsonRpcRequest;
  try { rpc = await request.json() as JsonRpcRequest; } catch { return json(rpcError(null, -32700, "Parse error"), 400); }
  if (rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") return json(rpcError(rpc.id, -32600, "Invalid JSON-RPC request"), 400);
  if (rpc.method === "notifications/initialized" || rpc.method.startsWith("notifications/")) return new Response(null, { status: 202 });
  if (rpc.method === "initialize") {
    return json({ jsonrpc: "2.0", id: rpc.id, result: {
      protocolVersion: "2025-11-25",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "qun-developer-api", version: "0.1.0" },
      instructions: "QUN Developer API MVP. Read-only tools only. Authenticated identity tools require a Supabase access token in the Authorization: Bearer header."
    }});
  }
  if (rpc.method === "ping") return json({ jsonrpc: "2.0", id: rpc.id, result: {} });
  if (rpc.method === "tools/list") {
    return json({ jsonrpc: "2.0", id: rpc.id, result: { tools: [
      { name: "qun_list_services", description: "List known QUN services and clearly labelled API exposure status. This does not claim that every service has a public API.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
      { name: "qun_whoami", description: "Validate the caller's Supabase access token and return their QUN identity/profile and read capabilities. Requires Authorization: Bearer <Supabase access token> on the MCP request.", inputSchema: { type: "object", properties: {}, additionalProperties: false } }
    ]}});
  }
  if (rpc.method === "tools/call") {
    const name = rpc.params?.name;
    if (name === "qun_list_services") return json({ jsonrpc: "2.0", id: rpc.id, result: toolResult({ services: SERVICES, note: "This is a service catalog, not a claim that all listed products expose public APIs." }) });
    if (name === "qun_whoami") {
      const result = await authenticate(request, env);
      if (result instanceof Response) {
        const body = await result.json();
        return json({ jsonrpc: "2.0", id: rpc.id, result: { ...toolResult(body), isError: true } }, 200);
      }
      try {
        const profile = await getProfile(result.user, result.accessToken, env);
        return json({ jsonrpc: "2.0", id: rpc.id, result: toolResult({
          id: result.user.id, email: result.user.email ?? null, profile,
          capabilities: ["qun:services:read", "qun:identity:read"]
        })});
      } catch {
        return json({ jsonrpc: "2.0", id: rpc.id, result: { ...toolResult({ error: "profile_unavailable", message: "Profile lookup failed; verify RLS and profiles schema." }), isError: true } });
      }
    }
    return json(rpcError(rpc.id, -32602, "Unknown tool name"), 200);
  }
  return json(rpcError(rpc.id, -32601, "Method not found"), 200);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = cors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    let response: Response;
    if (url.pathname === "/health" && request.method === "GET") {
      response = json({ ok: true, service: "qun-developer-api", version: "0.1.0", authProvider: "supabase", mcpPath: "/mcp", timestamp: new Date().toISOString() });
    } else if (url.pathname === "/v1/services" && request.method === "GET") {
      response = json({ data: SERVICES, note: "Service catalog only; API exposure status is listed per service." });
    } else if (url.pathname === "/v1/me" && request.method === "GET") {
      response = await currentUser(request, env);
    } else if (url.pathname === "/mcp") {
      response = await handleMcp(request, env);
    } else if (url.pathname === "/openapi.json" && request.method === "GET") {
      response = json({
        openapi: "3.1.0", info: { title: "QUN Developer API", version: "0.1.0", description: "MVP REST API backed by Supabase Auth. Not all QUN products expose public operations." },
        servers: [{ url: new URL("/", request.url).origin }],
        paths: {
          "/health": { get: { security: [], summary: "Health check", responses: { "200": { description: "Service health" } } } },
          "/v1/services": { get: { security: [], summary: "List QUN services", responses: { "200": { description: "Service catalog" } } } },
          "/v1/me": { get: { security: [{ bearerAuth: [] }], summary: "Get authenticated QUN identity", responses: { "200": { description: "Identity and profile" }, "401": { description: "Missing or invalid token" } } } }
        },
        components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "Supabase access token" } } }
      });
    } else {
      response = json({ error: { code: "not_found", message: "Route not found." } }, 404);
    }
    const merged = new Headers(response.headers);
    for (const [key, value] of Object.entries(headers)) merged.set(key, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
  }
};
