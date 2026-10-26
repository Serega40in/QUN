import { describe, expect, it } from "vitest";
import worker from "../src/index";

const env = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "test-anon-key" };

describe("QUN Developer API", () => {
  it("serves health metadata", async () => {
    const response = await worker.fetch(new Request("https://api.test/health"), env);
    expect(response.status).toBe(200);
    expect((await response.json() as any).service).toBe("qun-developer-api");
  });

  it("lists services without pretending they all have public APIs", async () => {
    const response = await worker.fetch(new Request("https://api.test/v1/services"), env);
    const body = await response.json() as any;
    expect(response.status).toBe(200);
    const node = body.data.find((service: any) => service.id === "qun-node");
    expect(node).toBeTruthy();
    expect(node.description).toContain("not exposed by this MVP");
    expect(body.note).toContain("API exposure status is listed per service");
  });

  it("requires a bearer token for identity", async () => {
    const response = await worker.fetch(new Request("https://api.test/v1/me"), env);
    expect(response.status).toBe(401);
    expect((await response.json() as any).error.code).toBe("unauthorized");
  });

  it("initializes MCP over JSON-RPC", async () => {
    const response = await worker.fetch(new Request("https://api.test/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } } })
    }), env);
    const body = await response.json() as any;
    expect(response.status).toBe(200);
    expect(body.result.serverInfo.name).toBe("qun-developer-api");
  });

  it("lists MCP tools", async () => {
    const response = await worker.fetch(new Request("https://api.test/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })
    }), env);
    const body = await response.json() as any;
    expect(body.result.tools.map((tool: any) => tool.name)).toEqual(["qun_list_services", "qun_whoami"]);
  });
});
