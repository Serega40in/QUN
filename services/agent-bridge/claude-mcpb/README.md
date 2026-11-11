# QUN Agent Bridge MCPB for Claude Desktop

This source package builds a self-contained Claude Desktop Extension (`.mcpb`) for the local browser bridge.

## Build

From this folder, install the MCPB CLI and pack the extension:

```powershell
npx -y @anthropic-ai/mcpb pack
```

The published bundle includes a self-contained Node.js server implementation using only Node built-ins. There are no npm runtime dependencies in the bundle.

## Install

1. Keep the QUN Agent Bridge Chrome/Chromium extension installed.
2. In Claude Desktop, open Settings → Extensions → Advanced settings → Install Extension…
3. Select `QUN-Agent-Bridge-0.1.1.mcpb`.
4. Enter the same 64-character token saved in the browser extension. Claude stores this sensitive value using the OS credential store.
5. Restart Claude Desktop if prompted.
6. In a chat, select the plus icon → Connectors, or review Settings → Extensions / Developer logs.

## MCP tools

- `browser_status`
- `browser_list_tabs` — requires the separate tabs permission in the browser extension.
- `browser_read_active_page` — requires permission for the specific website in the browser extension.
- `browser_open_url` — HTTP/HTTPS only.

The local HTTP/WebSocket server binds only to `127.0.0.1:43127`. Do not expose this port to the internet.
