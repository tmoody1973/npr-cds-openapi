import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readStory } from './reader';

const RM = 'https://organization.api.npr.org/v4/services/s921';
const text = (id: string, html: string) => [id, { id, text: html, profiles: [{ href: '/v1/profiles/text', rels: ['type'] }] }] as const;
const story = (over: any = {}) => ({
  id: 'g-s921-16132', title: 'Ladies First: Danielle Ponder', teaser: 'Change is hard.', publishDateTime: '2026-09-11T13:30:04-05:00',
  owners: [{ href: RM }], webPages: [{ href: 'https://radiomilwaukee.org/show/ladies-first/2026-09-11/danielle-ponder', rels: ['canonical'] }],
  layout: [{ href: '#/assets/img' }, { href: '#/assets/p1' }, { href: '#/assets/promo' }, { href: '#/assets/q1' }, { href: '#/assets/p2' }],
  assets: Object.fromEntries([
    ['img', { id: 'img', profiles: [{ href: '/v1/profiles/image', rels: ['type'] }] }],
    text('p1', '<em>Their talent</em> is undeniable &amp; real.'),
    ['promo', { id: 'promo', linkText: 'See also', profiles: [{ href: '/v1/profiles/promo-card', rels: ['type'] }] }],
    ['q1', { id: 'q1', quote: 'Everything has changed.', profiles: [{ href: '/v1/profiles/pull-quote', rels: ['type'] }] }],
    text('p2', 'In our conversation, Ponder reflects.'),
  ]),
  audio: [{ href: '#/assets/a', rels: ['primary'] }], ...over,
});

function deps(docs: any[], transcripts: Record<string, any> = {}) {
  const queries: URLSearchParams[] = [];
  return {
    queries,
    cdsQuery: async (p: URLSearchParams) => { queries.push(p); const ids = p.get('ids'); return { resources: ids ? docs.filter((d) => ids.split(',').includes(d.id)) : docs }; },
    cdsGet: async (id: string) => ({ resources: transcripts[id] ? [transcripts[id]] : [] }),
    catalog: { findStation: async () => [{ id: 's921', name: '88Nine Radio Milwaukee' }], findCollection: async () => [], learnFromDocs: async () => new Map() },
    homeStation: 's921',
  };
}

test('read_story returns paragraphs in layout order, html stripped, pull quotes included, promos skipped', async () => {
  const r = await readStory({ id: 'g-s921-16132' }, deps([story()]));
  assert.equal(r.source, 'body');
  assert.deepEqual(r.paragraphs, ['Their talent is undeniable & real.', '“Everything has changed.”', 'In our conversation, Ponder reflects.']);
  assert.equal(r.title, 'Ladies First: Danielle Ponder'); assert.equal(r.words, 14);
});

test('read_story falls back to the transcript when there is no body', async () => {
  const seg = story({ id: 'nx-s1-1', layout: [], assets: {}, owners: [{ href: 'https://organization.api.npr.org/v4/services/s1' }], meta: { extensionLinks: [{ href: '/v1/documents/nx-s1-9-transcript' }] } });
  const tr = { id: 'nx-s1-9-transcript', text: '<p>SCOTT DETROW, HOST: Good evening.</p><p>Second line.</p>', profiles: [{ href: '/v1/profiles/transcript', rels: ['type'] }] };
  const r = await readStory({ id: 'nx-s1-1' }, deps([seg], { 'nx-s1-9-transcript': tr }));
  assert.equal(r.source, 'transcript');
  assert.deepEqual(r.paragraphs, ['SCOTT DETROW, HOST: Good evening.', 'Second line.']);
  assert.match(r.rights!, /display-only/);
});

test('read_story says plainly when CDS holds only teaser and audio', async () => {
  const seg = story({ id: 'nx-s1-2', layout: [], assets: {}, meta: { extensionLinks: [] } });
  const r = await readStory({ id: 'nx-s1-2' }, deps([seg]));
  assert.equal(r.source, 'none'); assert.deepEqual(r.paragraphs, []);
  assert.match(r.note!, /only the teaser/i); assert.match(r.note!, /radiomilwaukee\.org/);
});

test('read_story truncates very long text and says so', async () => {
  const big = story({ layout: Array.from({ length: 60 }, (_, i) => ({ href: `#/assets/t${i}` })), assets: Object.fromEntries(Array.from({ length: 60 }, (_, i) => text(`t${i}`, 'word '.repeat(60)))) });
  const r = await readStory({ id: 'g-s921-16132', maxChars: 2000 }, deps([big]));
  assert.ok(r.paragraphs.join(' ').length <= 2100); assert.match(r.note!, /truncated/i); assert.equal(r.words, 3600);
});

test('read_story accepts a station url like check_story does', async () => {
  const d = deps([story()]);
  const r = await readStory({ url: 'https://www.radiomilwaukee.org/show/ladies-first/2026-09-11/danielle-ponder/' }, d);
  assert.equal(r.id, 'g-s921-16132'); assert.equal(d.queries[0].get('ownerHrefs'), RM);
});

test('read_story splits a plain-text transcript on single line breaks', async () => {
  const seg = story({ id: 'nx-s1-3', layout: [], assets: {}, meta: { extensionLinks: [{ href: '/v1/documents/nx-s1-3-transcript' }] } });
  const tr = { id: 'nx-s1-3-transcript', text: 'HOST: First line.\nGUEST: Second line.\n\nHOST: Third.', profiles: [{ href: '/v1/profiles/transcript', rels: ['type'] }] };
  const r = await readStory({ id: 'nx-s1-3' }, deps([seg], { 'nx-s1-3-transcript': tr }));
  assert.deepEqual(r.paragraphs, ['HOST: First line.', 'GUEST: Second line.', 'HOST: Third.']);
});
