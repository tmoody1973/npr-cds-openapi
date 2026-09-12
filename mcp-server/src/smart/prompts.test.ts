import { test } from 'node:test';
import assert from 'node:assert/strict';
import { morningPrep, newsletterDraft } from './prompts';

test('morning-prep names the tools in order and the rundown shape', () => {
  const t = morningPrep({ since: '2026-09-12', station: 'Radio Milwaukee' });
  const order = ['whats_new_since', 'find_stories', 'latest_newscast'].map((n) => t.indexOf(n));
  assert.ok(order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2], 'tools appear in call order');
  assert.match(t, /Radio Milwaukee/); assert.match(t, /2026-09-12/);
  assert.match(t, /talk break/i); assert.match(t, /read out loud/i);
});

test('morning-prep without a station leans on the home station', () => {
  const t = morningPrep({});
  assert.match(t, /home station/i);
});

test('newsletter-draft requires links back and forbids storing or quoting at length', () => {
  const t = newsletterDraft({ topic: 'housing' });
  assert.match(t, /find_stories/); assert.match(t, /housing/);
  assert.match(t, /canonical link|link back/i); assert.match(t, /audio link/i);
  assert.match(t, /do not (store|copy)/i); assert.match(t, /one sentence|two sentences/i);
});

test('morning-prep computes yesterday 6am local as a real timestamp by default', () => {
  const t = morningPrep({});
  const m = t.match(/since="(\d{4}-\d{2}-\d{2}T06:00:00[+-]\d{2}:\d{2})"/);
  assert.ok(m, `no ISO timestamp in: ${t.slice(0, 200)}`);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  assert.equal(m![1].slice(0, 10), `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`);
});

test('newsletter-draft computes a date seven days back by default', () => {
  const t = newsletterDraft({});
  assert.match(t, /since="\d{4}-\d{2}-\d{2}"/); assert.doesNotMatch(t, /last 7 days"/);
});
