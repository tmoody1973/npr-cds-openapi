# npr-cds-mcp

[Source repository](https://github.com/tmoody1973/npr-cds-openapi)

MCP server generated from **NPR Content Distribution Service (CDS) API** by [Cortex Docs](https://github.com/cortex-docs/cortex).

## Client Setup Guide

Connect your MCP server to an MCP-compatible AI client.

### 1. What you're connecting

| | |
|---|---|
| **Transport** | `stdio` |
| **Package** | `npr-cds-mcp` |
| **Command** | `npx npr-cds-mcp` |
| **Runtime** | `Node.js 20+` |
| **Auth** | `none` |

### 2. Prerequisites

- Node.js 20+ and npm on PATH
- No build step needed — `npx` downloads and runs the package automatically

### 3. Universal config shape

Most clients use this JSON block. Learn it once:

```json
{
  "mcpServers": {
    "npr-cds-mcp": {
      "command": "npx",
      "args": ["npr-cds-mcp"]
    }
  }
}
```

### 4. Per-client setup

#### 4.1 Claude Code (CLI)

```bash
claude mcp add npr-cds-mcp -- npx npr-cds-mcp
```

Scope with `--scope`: `local` (default), `project` (committed .mcp.json), or `user` (all projects).

```bash
claude mcp list          # see configured servers
claude mcp get npr-cds-mcp   # inspect one
claude mcp remove npr-cds-mcp
```

#### 4.2 Claude Desktop

Edit the config, then fully restart the app:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "npr-cds-mcp": {
      "command": "npx",
      "args": ["npr-cds-mcp"]
    }
  }
}
```

#### 4.3 Cursor

Project: `.cursor/mcp.json` — Global: `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "npr-cds-mcp": {
      "command": "npx",
      "args": ["npr-cds-mcp"]
    }
  }
}
```

#### 4.4 VS Code (GitHub Copilot)

Create `.vscode/mcp.json`. Note: VS Code uses `"servers"`, not `"mcpServers"`.

```json
{
  "servers": {
    "npr-cds-mcp": {
      "command": "npx",
      "args": ["npr-cds-mcp"]
    }
  }
}
```

#### 4.5 OpenAI Codex CLI

Config in `~/.codex/config.toml` (TOML format):

```toml
[mcp_servers.npr-cds-mcp]
command = "npx"
args = ["npr-cds-mcp"]
```

#### 4.6 Windsurf

Config: `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "npr-cds-mcp": {
      "command": "npx",
      "args": ["npr-cds-mcp"]
    }
  }
}
```

#### 4.7 Cline (VS Code extension)

```json
{
  "mcpServers": {
    "npr-cds-mcp": {
      "command": "npx",
      "args": ["npr-cds-mcp"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

#### 4.8 Continue

Create `.continue/mcpServers/npr-cds-mcp.yaml`:

```yaml
name: npr-cds-mcp
version: 0.0.1
schema: v1
mcpServers:
  - name: npr-cds-mcp
    command: npx
    args:
      - "npr-cds-mcp"
```

#### 4.9 Zed

In `settings.json`. Note: Zed uses `"context_servers"`.

```json
{
  "context_servers": {
    "npr-cds-mcp": {
      "source": "custom",
      "command": "npx",
      "args": ["npr-cds-mcp"]
    }
  }
}
```

#### 4.10 JetBrains IDEs

Settings → Tools → AI Assistant → Model Context Protocol (MCP) → Add Server:

```json
{
  "mcpServers": {
    "npr-cds-mcp": {
      "command": "npx",
      "args": ["npr-cds-mcp"]
    }
  }
}
```

### 5. Quick reference

| Client | Config location | Key | Format |
|--------|----------------|-----|--------|
| Claude Code | `claude mcp add` | — | CLI |
| Claude Desktop | `~/Library/.../claude_desktop_config.json` | `mcpServers` | JSON |
| Cursor | `.cursor/mcp.json` | `mcpServers` | JSON |
| VS Code | `.vscode/mcp.json` | `servers` | JSON |
| Codex CLI | `~/.codex/config.toml` | `mcp_servers` | TOML |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` | JSON |
| Cline | VS Code settings | `mcpServers` | JSON |
| Continue | `.continue/mcpServers/npr-cds-mcp.yaml` | `mcpServers` | YAML |
| Zed | `settings.json` | `context_servers` | JSON |
| JetBrains | AI Assistant settings | `mcpServers` | JSON |

### 6. Troubleshooting

- **npx not found** — Ensure Node.js 18+ is installed and npm is on your PATH
- **Command not found in GUI apps** — GUI apps may not inherit shell PATH. Use the full path: /usr/local/bin/npx
- **Server not responding** — Test manually: `npx npr-cds-mcp`
- **Permission denied** — Try: `npx --yes npr-cds-mcp`

## Agent Instructions

Read the project documentation and SDK reference tools before writing integration code. Prefer a generated SDK when one supports the user's language. Use direct API tools when no suitable SDK is available.

## Tools

13 tools available for AI agents via `npr-cds-mcp`

### `docs_query_semantics_and_auth`

`DOCS`

Read documentation: Query semantics and auth (Using CDS). Returns full markdown content.

<details>
<summary>MCP call snippet</summary>

```json
// Call this tool to get full content
// The agent receives the complete markdown
// document to use as context.

{
  "name": "docs_query_semantics_and_auth",
  "arguments": {}
}

// Returns: full document content (markdown)
```

</details>

### `docs_hyfin_labels_and_sync_rules`

`DOCS`

Read documentation: HYFIN labels and sync rules (Using CDS). Returns full markdown content.

<details>
<summary>MCP call snippet</summary>

```json
// Call this tool to get full content
// The agent receives the complete markdown
// document to use as context.

{
  "name": "docs_hyfin_labels_and_sync_rules",
  "arguments": {}
}

// Returns: full document content (markdown)
```

</details>

### `intro_rest`

`DOCS`

Read the CDS REST API introduction. Returns overview, base URL, rate limiting, and other essential context for the CDS REST API.

<details>
<summary>MCP call snippet</summary>

```json
// Call this tool to get full content
// The agent receives the complete markdown
// document to use as context.

{
  "name": "intro_rest",
  "arguments": {}
}

// Returns: full document content (markdown)
```

</details>

### `queryDocuments`

`REST` · **GET** · `/v1/documents`

Query documents

| Name | Type | Required |
|------|------|----------|
| `ids` | `array` | optional |
| `excludedIds` | `array` | optional |
| `profileIds` | `array` | optional |
| `excludedProfileIds` | `array` | optional |
| `collectionIds` | `array` | optional |
| `ownerHrefs` | `array` | optional |
| `excludedOwnerHrefs` | `array` | optional |
| `nprWebsitePaths` | `array` | optional |
| `publishDateTime` | `string` | optional |
| `editorialLastModifiedDateTime` | `string` | optional |
| `recommendUntilDateTime` | `string` | optional |
| `showDates` | `string` | optional |
| `seasonNumber` | `number` | optional |
| `sort` | `string` | optional |
| `limit` | `number` | optional |
| `offset` | `number` | optional |
| `transclude` | `array` | optional |

<details>
<summary>MCP call snippet</summary>

```json
// MCP tool call
{
  "name": "queryDocuments",
  "arguments": {
      "ids": "<array>",
      "excludedIds": "<array>",
      "profileIds": "<array>",
      "excludedProfileIds": "<array>",
      "collectionIds": "<array>",
      "ownerHrefs": "<array>",
      "excludedOwnerHrefs": "<array>",
      "nprWebsitePaths": "<array>",
      "publishDateTime": "<string>",
      "editorialLastModifiedDateTime": "<string>",
      "recommendUntilDateTime": "<string>",
      "showDates": "<string>",
      "seasonNumber": "<number>",
      "sort": "<string>",
      "limit": "<number>",
      "offset": "<number>",
      "transclude": "<array>"
  }
}
```

</details>

### `getDocument`

`REST` · **GET** · `/v1/documents/{documentId}`

Get one document

| Name | Type | Required |
|------|------|----------|
| `documentId` | `string` | **required** |
| `transclude` | `array` | optional |

<details>
<summary>MCP call snippet</summary>

```json
// MCP tool call
{
  "name": "getDocument",
  "arguments": {
      "documentId": "<string>",
      "transclude": "<array>"
  }
}
```

</details>

### `putDocument`

`REST` · **PUT** · `/v1/documents/{documentId}`

Create or update a document

| Name | Type | Required |
|------|------|----------|
| `documentId` | `string` | **required** |
| `body` | `object` | **required** |

<details>
<summary>MCP call snippet</summary>

```json
// MCP tool call
{
  "name": "putDocument",
  "arguments": {
      "documentId": "<string>",
      "body": "<object>"
  }
}
```

</details>

### `deleteDocument`

`REST` · **DELETE** · `/v1/documents/{documentId}`

Delete a document

| Name | Type | Required |
|------|------|----------|
| `documentId` | `string` | **required** |

<details>
<summary>MCP call snippet</summary>

```json
// MCP tool call
{
  "name": "deleteDocument",
  "arguments": {
      "documentId": "<string>"
  }
}
```

</details>

### `listProfiles`

`REST` · **GET** · `/v1/profiles`

List all profiles

<details>
<summary>MCP call snippet</summary>

```json
// MCP tool call
{
  "name": "listProfiles",
  "arguments": {}
}
```

</details>

### `getProfile`

`REST` · **GET** · `/v1/profiles/{profileName}`

Get one profile's JSON Schema

| Name | Type | Required |
|------|------|----------|
| `profileName` | `string` | **required** |

<details>
<summary>MCP call snippet</summary>

```json
// MCP tool call
{
  "name": "getProfile",
  "arguments": {
      "profileName": "<string>"
  }
}
```

</details>

### `getSchema`

`REST` · **GET** · `/v1/schemas/{schemaName}`

Get a shared JSON Schema

| Name | Type | Required |
|------|------|----------|
| `schemaName` | `string` | **required** |

<details>
<summary>MCP call snippet</summary>

```json
// MCP tool call
{
  "name": "getSchema",
  "arguments": {
      "schemaName": "<string>"
  }
}
```

</details>

### `listClientProfiles`

`REST` · **GET** · `/v1/client-profiles`

List client profiles

| Name | Type | Required |
|------|------|----------|
| `limit` | `number` | optional |
| `offset` | `number` | optional |

<details>
<summary>MCP call snippet</summary>

```json
// MCP tool call
{
  "name": "listClientProfiles",
  "arguments": {
      "limit": "<number>",
      "offset": "<number>"
  }
}
```

</details>

### `getClientProfile`

`REST` · **GET** · `/v1/client-profiles/{profileName}`

Get one client profile

| Name | Type | Required |
|------|------|----------|
| `profileName` | `string` | **required** |

<details>
<summary>MCP call snippet</summary>

```json
// MCP tool call
{
  "name": "getClientProfile",
  "arguments": {
      "profileName": "<string>"
  }
}
```

</details>

### `confirmSubscription`

`REST` · **POST** · `/v1/subscriptions/confirmations`

Confirm a notification subscription

| Name | Type | Required |
|------|------|----------|
| `Type` | `string` | optional |

<details>
<summary>MCP call snippet</summary>

```json
// MCP tool call
{
  "name": "confirmSubscription",
  "arguments": {
      "Type": "<string>"
  }
}
```

</details>

## Verify

```bash
npx @modelcontextprotocol/inspector npx npr-cds-mcp
```
