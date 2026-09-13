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
  assert.deepEqual(tools.map((t) => t.name).sort(), ['check_story', 'coverage_gap', 'coverage_scan', 'find_collection', 'find_station', 'find_stories', 'latest_newscast', 'network_pulse', 'read_story', 'search_archive', 'station_labels', 'whats_new_since']);
  await client.close(); await server.close();
});

// find_station and find_collection resolve through Catalog to a plain array. MCP requires
// structuredContent to be an object; a strict client (Claude Code 2.1.270) rejects an array with
// "MCP error -32602: Invalid tools/call result: expected record, received array".
test('find_station and find_collection results carry an object, not an array, as structuredContent', async () => {
  process.env.NPR_CDS_TOKEN = 'test-token'; // so cdsQuery's auth check does not throw before the fake fetch runs
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => {
    const body = String(url).includes('organization.api.npr.org/v4/services') ? [{ id: 's715', name: 'WXPN' }] : { resources: [] };
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as Response;
  }) as typeof fetch;
  try {
    const { registerSmartTools } = await import('./register');
    const server = new McpServer({ name: 't2', version: '0' });
    registerSmartTools(server);
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: 'c2', version: '0' }); await client.connect(b);
    const station = await client.callTool({ name: 'find_station', arguments: { query: 'WXPN' } });
    const collection = await client.callTool({ name: 'find_collection', arguments: { query: 'Technology' } });
    for (const r of [station, collection] as any[]) {
      assert.ok(r.structuredContent && typeof r.structuredContent === 'object' && !Array.isArray(r.structuredContent), `expected object structuredContent, got ${JSON.stringify(r.structuredContent)}`);
    }
    await client.close(); await server.close();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the four prompts are registered, and show-prep renders with a show name', async () => {
  process.env.XDG_CACHE_HOME = mkdtempSync(path.join(tmpdir(), 'cds-register-'));
  const { registerSmartTools } = await import('./register');
  const server = new McpServer({ name: 't', version: '0' });
  registerSmartTools(server);
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: 'c', version: '0' }); await client.connect(b);
  const { prompts } = await client.listPrompts();
  assert.deepEqual(prompts.map((p) => p.name).sort(), ['morning-prep', 'newsletter-draft', 'show-prep', 'weekly-prep']);
  const r = await client.getPrompt({ name: 'show-prep', arguments: { show: 'Ladies First' } });
  assert.match((r.messages[0].content as any).text, /show="Ladies First"/);
  await client.close(); await server.close();
});
