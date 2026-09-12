import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safe } from './register';

test('safe turns a thrown error into an isError result carrying only the message', async () => {
  const r: any = await safe(async () => { throw new Error('No station matches "zzz".'); })({});
  assert.equal(r.isError, true);
  assert.equal(r.content[0].text, 'No station matches "zzz".');
  assert.equal(r.structuredContent, undefined);
});

test('safe wraps a value as text plus structuredContent', async () => {
  const r: any = await safe(async (x: number) => ({ n: x }))(2);
  assert.deepEqual(r.structuredContent, { n: 2 }); assert.equal(r.content[0].text, '{"n":2}'); assert.equal(r.isError, undefined);
});

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('find_stories advertises every argument the function accepts, so none is silently dropped', async () => {
  process.env.XDG_CACHE_HOME = mkdtempSync(path.join(tmpdir(), 'cds-register-')); // keep the test off the real cache
  const { registerSmartTools } = await import('./register');
  const server = new McpServer({ name: 't', version: '0' });
  registerSmartTools(server);
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: 'c', version: '0' }); await client.connect(b);
  const { tools } = await client.listTools();
  const props = Object.keys((tools.find((t) => t.name === 'find_stories')!.inputSchema as any).properties ?? {});
  for (const key of ['query', 'station', 'show', 'collection', 'since', 'until', 'limit', 'scanPages', 'kind']) assert.ok(props.includes(key), `missing ${key}`);
  assert.deepEqual(tools.map((t) => t.name).sort(), ['check_story', 'find_collection', 'find_station', 'find_stories', 'latest_newscast', 'read_story', 'station_labels', 'whats_new_since']);
  await client.close(); await server.close();
});
