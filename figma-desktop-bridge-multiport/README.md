# Figma Desktop Bridge — Multi-Port Selector

Enhanced fork of [figma-console-mcp](https://github.com/southleft/figma-console-mcp) Desktop Bridge plugin with **multi-port selection** support.

## Problem

When running 2+ AI apps (Cursor, Claude Code, etc.) simultaneously, each starts an MCP server on a different port (9223–9232). The original plugin auto-connects to **all** servers, making it impossible to dedicate a specific Figma file to a specific AI workspace.

## Solution

This enhanced bridge adds a **port selector UI** that appears when multiple MCP servers are detected:

```
┌──────────────────────────────────────┐
│ Found 2 AI servers                   │
│                                      │
│ ● Port 9223 — Cursor                 │
│   v1.35.0 • uptime: 2h • File B     │
│                                      │
│ ○ Port 9224 — Claude Code            │
│   v1.35.0 • uptime: 5m • no files   │
│                                      │
│ [Connect]              [Auto]        │
└──────────────────────────────────────┘
```

### Behavior

| Scenario | Action |
|----------|--------|
| 1 server found | Auto-connect (unchanged, zero-click) |
| >1 servers found | Show port selector UI |
| Preferred port saved | Auto-connect to saved port |

### Port Preference

- User's port choice is **saved per-file** via Figma `clientStorage`
- On plugin reload, it auto-reconnects to the preferred port
- Click "Auto" to clear preference and connect to all servers

## Modified Files

| File | Changes |
|------|---------|
| `figma-desktop-bridge/ui.html` | Port selector UI + enhanced scan logic + preference persistence |
| `figma-desktop-bridge/code.js` | `STORE_PORT_PREFERENCE` / `GET_PORT_PREFERENCE` handlers |
| `src/core/websocket-server.ts` | `/health` endpoint returns `serverLabel`, `connectedFiles`, `port` |

## Setup

### 1. Configure Server Labels

Add `FIGMA_SERVER_LABEL` env var to each MCP server config:

```json
// Cursor MCP config
{
  "env": {
    "FIGMA_SERVER_LABEL": "Cursor"
  }
}

// Claude Code MCP config  
{
  "env": {
    "FIGMA_SERVER_LABEL": "Claude Code"
  }
}
```

### 2. Install Plugin Files

Copy the `figma-desktop-bridge/` files to replace the original plugin:

```bash
# Replace the stable plugin directory
cp figma-desktop-bridge/* ~/.figma-console-mcp/plugin/
```

Or import `figma-desktop-bridge/manifest.json` in Figma:
**Plugins → Development → Import plugin from manifest...**

### 3. Server-Side (Optional)

To get enhanced `/health` responses with server labels, apply the `src/core/websocket-server.ts` changes to your figma-console-mcp installation.

## Based On

- [southleft/figma-console-mcp](https://github.com/southleft/figma-console-mcp) — Original repository
- Port range: 9223–9232 (10 ports, unchanged)
- All existing features preserved (cloud mode, multi-client per server, etc.)
