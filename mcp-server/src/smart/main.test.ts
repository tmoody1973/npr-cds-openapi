import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Drives `npr-cds-mcp station` as a real process with piped input, a throwaway HOME, and a
// pre-seeded station directory so no network is needed.
function run(input: string) {
  const home = mkdtempSync(path.join(tmpdir(), 'cds-main-'));
  const cache = path.join(home, 'cache', 'npr-cds'); mkdirSync(cache, { recursive: true });
  writeFileSync(path.join(cache, 'stations.json'), JSON.stringify({ fetchedAt: Date.now(), items: [{ id: 's55', name: 'KCRW' }, { id: 's921', name: '88Nine Radio Milwaukee' }] }));
  const r = spawnSync(process.execPath, ['--import', 'tsx', path.join(__dirname, '..', 'main.ts'), 'station'], {
    input, encoding: 'utf8', timeout: 20000, env: { ...process.env, HOME: home, XDG_CACHE_HOME: path.join(home, 'cache'), NPR_CDS_HOME_STATION: '' },
  });
  const config = path.join(home, '.config', 'npr-cds', 'config.json');
  return { ...r, saved: existsSync(config) ? JSON.parse(readFileSync(config, 'utf8')).homeStation : undefined };
}

test('station: a name and a pick saves the id and exits 0', () => {
  const r = run('kcrw\n1\n');
  assert.equal(r.status, 0, r.stderr); assert.equal(r.saved, 's55'); assert.match(r.stderr, /Saved KCRW \(s55\)/);
});

test('station: a non-numeric pick asks again, then a valid pick saves', () => {
  const r = run('milwaukee\nx\nmilwaukee\n1\n');
  assert.equal(r.status, 0, r.stderr); assert.equal(r.saved, 's921');
});

test('station: blank input skips and exits 0 without writing', () => {
  const r = run('\n');
  assert.equal(r.status, 0, r.stderr); assert.equal(r.saved, undefined); assert.match(r.stderr, /No station saved/);
});

test('station: end of input mid-way exits instead of hanging', () => {
  const r = run('kcrw\n');
  assert.notEqual(r.signal, 'SIGTERM', 'must not hit the timeout'); assert.equal(r.saved, undefined);
});

// Regression check for the smart layer's `_instructions` override (main-stdio.ejs, right after
// registerSmartTools): starts the real built server and confirms the instructions it sends at
// initialize actually reach a client, so an SDK rename of that field cannot silently drop them.
test('server instructions reach the client at initialize, naming the home station', async () => {
  const home = mkdtempSync(path.join(tmpdir(), 'cds-main-'));
  const configDir = path.join(home, '.config', 'npr-cds');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ homeStation: 's921' }));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(__dirname, '..', '..', 'dist', 'main.js')],
    env: { HOME: home, XDG_CACHE_HOME: path.join(home, 'cache'), NPR_CDS_HOME_STATION: '', NPR_CDS_TOKEN: 'test-token' },
  });
  const client = new Client({ name: 'main-test', version: '0' });
  await client.connect(transport);
  assert.match(client.getInstructions() ?? '', /^Home station: s921\./);
  await client.close();
});
