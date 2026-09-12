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
import { Catalog } from './smart/catalog';
import { fetchJson } from './smart/cds';
import { CONFIG_DIR, saveHomeStation } from './smart/config';

const TOKEN_FILE = path.join(CONFIG_DIR, 'token');

async function setup() {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const token = (await rl.question('Paste your NPR CDS token (from NPR Member Partnership): ')).trim();
  rl.close();
  if (!token) { console.error('No token entered; nothing saved.'); process.exit(1); }
  await mkdir(path.dirname(TOKEN_FILE), { recursive: true, mode: 0o700 });
  await writeFile(TOKEN_FILE, token + '\n', { mode: 0o600 });
  await chmod(TOKEN_FILE, 0o600);
  console.error(`Saved to ${TOKEN_FILE} (readable only by you). NPR_CDS_TOKEN in the environment still takes priority.`);
  await chooseStation();
}

// Ask which station this is, resolve it through NPR's public directory, remember the id.
async function chooseStation() {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const catalog = new Catalog(fetchJson, path.join(process.env.XDG_CACHE_HOME || path.join(homedir(), '.cache'), 'npr-cds'));
  try {
    for (;;) {
      const name = (await rl.question('Which station are you? (name, call letters, or city; blank to skip): ')).trim();
      if (!name) { console.error('No station saved. Set NPR_CDS_HOME_STATION later, or run setup again.'); return; }
      const matches = await catalog.findStation(name);
      if (!matches.length) { console.error('No station matched. Try the call letters.'); continue; }
      matches.forEach((m, i) => console.error(`  ${i + 1}. ${m.name} (${m.id})${m.city ? `, ${m.city}` : ''}`));
      const pick = (await rl.question(`Which one? [1-${matches.length}, or blank to search again]: `)).trim();
      const chosen = matches[Number(pick) - 1];
      if (!chosen) continue;
      saveHomeStation(chosen.id);
      console.error(`Saved ${chosen.name} (${chosen.id}) to ${path.join(CONFIG_DIR, 'config.json')}. NPR_CDS_HOME_STATION in the environment still takes priority.`);
      return;
    }
  } finally { rl.close(); }
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'setup') return setup();
  if (cmd === 'station') return chooseStation();
  if (cmd === '--help' || cmd === '-h') {
    console.error('npr-cds-mcp          start the MCP server (stdio)\nnpr-cds-mcp setup    save your CDS token, then choose your station\nnpr-cds-mcp station  choose or change your station only');
    return;
  }
  const server = createServer();
  registerSmartTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
