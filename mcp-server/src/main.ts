#!/usr/bin/env node
// hyfin override: adds a `setup` subcommand that stores the CDS token in the user's home
// folder, so the install is `npx npr-cds-mcp setup` once, then no flags.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createInterface } from 'node:readline/promises';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { createServer } from './server';
import { registerSmartTools } from './smart/register';

const TOKEN_FILE = path.join(homedir(), '.config', 'npr-cds', 'token');

async function setup() {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const token = (await rl.question('Paste your NPR CDS token (from NPR Member Partnership): ')).trim();
  rl.close();
  if (!token) { console.error('No token entered; nothing saved.'); process.exit(1); }
  await mkdir(path.dirname(TOKEN_FILE), { recursive: true, mode: 0o700 });
  await writeFile(TOKEN_FILE, token + '\n', { mode: 0o600 });
  await chmod(TOKEN_FILE, 0o600);
  console.error(`Saved to ${TOKEN_FILE} (readable only by you). NPR_CDS_TOKEN in the environment still takes priority.`);
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'setup') return setup();
  if (cmd === '--help' || cmd === '-h') {
    console.error('npr-cds-mcp          start the MCP server (stdio)\nnpr-cds-mcp setup    save your CDS token to ~/.config/npr-cds/token');
    return;
  }
  const server = createServer();
  registerSmartTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
