import { BrowserBridge } from "./index.js";

const VERSION = "0.1.0";
const DEVICE_ID = process.env.QUN_AGENT_DEVICE_ID || "windows-main";
const DEVICE_NAME = process.env.QUN_AGENT_DEVICE_NAME || "QUN Windows";
const CLOUD_URL = (process.env.QUN_AGENT_CLOUD_URL || "").replace(/\/+$/, "");
const DEVICE_KEY = process.env.QUN_AGENT_DEVICE_KEY || "";
const BROWSER_TOKEN = process.env.QUN_AGENT_TOKEN || "";
const HEARTBEAT_INTERVAL_MS = 10_000;
const POLL_INTERVAL_MS = 1_500;
const MAX_BACKOFF_MS = 15_000;

function log(message) {
  process.stderr.write("[QUN Agent Core] " + message + "\n");
}
function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function safeUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Invalid URL."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only HTTP(S) URLs are supported.");
  }
  if (url.username || url.password) throw new Error("URLs with credentials are blocked.");
  return url.toString();
}

async function cloudRequest(route, body) {
  const response = await fetch(CLOUD_URL + route, {
    method: "POST",
    headers: {
      "authorization": "Bearer " + DEVICE_KEY,
      "content-type": "application/json",
      "accept": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { error: text.slice(0, 1000) }; }
  if (!response.ok) {
    throw new Error("Cloud API " + response.status + ": " + String(parsed?.error || response.statusText));
  }
  return parsed;
}

async function reportResult(commandId, status, result, error) {
  return cloudRequest("/agent/result", {
    deviceId: DEVICE_ID,
    commandId,
    status,
    ...(result === undefined ? {} : { result }),
    ...(error ? { error: String(error).slice(0, 2000) } : {}),
  });
}

async function executeBrowserCommand(bridge, command) {
  const args = command?.args && typeof command.args === "object" && !Array.isArray(command.args)
    ? command.args
    : {};

  switch (command?.action) {
    case "browser.list_tabs":
      return await bridge.request("list_tabs");
    case "browser.read_active_page":
      return await bridge.request("read_page", Number.isInteger(args.tabId) && args.tabId > 0
        ? { tabId: args.tabId }
        : {});
    case "browser.open_url":
      return await bridge.request("open_url", { url: safeUrl(args.url) });
    default:
      throw new Error("Action is not allowed by this agent version: " + String(command?.action));
  }
}

async function main() {
  if (!CLOUD_URL || !/^https:\/\//i.test(CLOUD_URL)) {
    throw new Error("QUN_AGENT_CLOUD_URL must be an HTTPS URL, for example https://qdxjltqlnphvzafapncm.supabase.co/functions/v1/qun-agent-core");
  }
  if (!/^[a-f0-9]{64}$/i.test(DEVICE_KEY)) {
    throw new Error("QUN_AGENT_DEVICE_KEY must be a 64-character hexadecimal secret stored in Windows DPAPI.");
  }
  if (!/^[a-f0-9]{64}$/i.test(BROWSER_TOKEN)) {
    throw new Error("QUN_AGENT_TOKEN must be the 64-character token saved in the browser extension.");
  }
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(DEVICE_ID)) {
    throw new Error("QUN_AGENT_DEVICE_ID is invalid.");
  }

  const bridge = new BrowserBridge({ token: BROWSER_TOKEN, host: "127.0.0.1", port: 43127 });
  await bridge.start();

  let stopping = false;
  let lastHeartbeat = 0;
  let backoff = 1000;

  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    log("Stopping…");
    await bridge.stop().catch(() => {});
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  log("Cloud control loop started for " + DEVICE_ID + ".");
  log("Dashboard: http://127.0.0.1:43127/");

  while (!stopping) {
    try {
      if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
        await cloudRequest("/agent/heartbeat", {
          deviceId: DEVICE_ID,
          name: DEVICE_NAME,
          platform: "windows",
          version: VERSION,
          capabilities: ["browser.list_tabs", "browser.read_active_page", "browser.open_url"],
        });
        lastHeartbeat = Date.now();
      }

      const next = await cloudRequest("/agent/next", { deviceId: DEVICE_ID });
      backoff = 1000;
      const command = next?.command;

      if (!command) {
        await pause(POLL_INTERVAL_MS);
        continue;
      }

      log("Executing allow-listed action " + command.action + " (" + command.command_id + ").");
      try {
        const result = await executeBrowserCommand(bridge, command);
        await reportResult(command.command_id, "succeeded", result);
        log("Action completed: " + command.action + ".");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await reportResult(command.command_id, "failed", undefined, message).catch((reportError) => {
          log("Could not report failed action: " + (reportError instanceof Error ? reportError.message : String(reportError)));
        });
        log("Action failed: " + message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("Cloud connection issue: " + message);
      await pause(backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    }
  }
}

main().catch((error) => {
  log("Startup failed: " + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
