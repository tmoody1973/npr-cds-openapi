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
