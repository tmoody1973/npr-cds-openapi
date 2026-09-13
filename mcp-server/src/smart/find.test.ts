import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findStories, type FindDeps } from './find';

const story = (id: string, title: string, date: string, owner = 's1', coll: string[] = []) => ({
  id, title, teaser: '', publishDateTime: `${date}T10:00:00-04:00`,
  owners: [{ href: `https://organization.api.npr.org/v4/services/${owner}` }],
  webPages: [{ href: `https://x/${id}`, rels: ['canonical'] }],
  collections: coll.map((c) => ({ href: `/v1/documents/${c}`, rels: ['topic'] })),
});

function deps(): FindDeps & { queries: URLSearchParams[] } {
  const queries: URLSearchParams[] = [];
  return {
    queries,
    cdsQuery: async (params) => {
      queries.push(params);
      const ids = params.get('collectionIds');
      if (ids?.includes('133775819')) return { resources: [story('a1', 'Foldable iPhone', '2026-09-09', 's1', ['133775819']), story('a2', 'Why AI builders worry', '2026-09-12', 's1', ['133775819'])] };
      if (ids?.includes('g-s921-13049')) return { resources: [story('lf1', 'Ladies First: Danielle Ponder', '2026-09-11', 's921'), story('lf2', 'Ladies First: Blessing Jolie', '2026-09-04', 's921')] };
      return { resources: [story('a2', 'Why AI builders worry', '2026-09-12'), story('b1', 'Anthropic researcher resigns amid AI fears', '2026-09-09'), story('c1', 'Angels new owner', '2026-09-08')] };
    },
    catalog: {
      findStation: async (q) => (q.toLowerCase().includes('milwaukee') ? [{ id: 's921', name: '88Nine Radio Milwaukee' }] : []),
      findCollection: async (q) => (/ladies/i.test(q) ? [{ id: 'g-s921-13049', title: 'Ladies First', type: 'series' }] : /^ai$/i.test(q) ? [{ id: '133775819', title: 'Understanding AI', type: 'topic' }, { id: '13', title: 'Fresh Air', type: 'program' }] : []),
      learnFromDocs: async (docs) => new Map(docs.flatMap((d: any) => d.collections.map((l: any) => l.href.replace(/^.*\//, ''))).map((id: string) => [id, { id, title: id === '133775819' ? 'Understanding AI' : id, type: 'topic' }])),
    },
    homeStation: 's921',
  };
}

test('show name resolves to a collection query, newest first', async () => {
  const d = deps();
  const r = await findStories({ show: 'Ladies First', limit: 3 }, d);
  assert.deepEqual(r.hits.map((h) => h.id), ['lf1', 'lf2']);
  assert.equal(d.queries[0].get('collectionIds'), 'g-s921-13049');
  assert.equal(d.queries[0].get('sort'), 'publishDateTime:desc');
  assert.match(r.searched, /Ladies First/);
});

test('free-text query merges collection hits with keyword hits and dedupes', async () => {
  const r = await findStories({ query: 'AI' }, deps());
  assert.deepEqual(r.hits.map((h) => h.id), ['a2', 'b1', 'a1']);
  assert.equal(r.hits.find((h) => h.id === 'a1')?.collections[0].name, 'Understanding AI');
  assert.match(r.searched, /Understanding AI/); assert.doesNotMatch(r.searched, /Fresh Air/, 'a fuzzy collection whose title lacks the query word is dropped');
});

test('a keyword scan with no station reads the home station first, then NPR, and says so with both counts', async () => {
  const d = deps();
  d.catalog.stations = async () => [{ id: 's921', name: '88Nine Radio Milwaukee' }];
  const r = await findStories({ query: 'Angels' }, d);
  const scans = d.queries.filter((q) => !q.get('collectionIds')).map((q) => q.get('ownerHrefs'));
  assert.deepEqual(scans, ['https://organization.api.npr.org/v4/services/s921', 'https://organization.api.npr.org/v4/services/s1']);
  assert.match(r.searched, /over 3 newest 88Nine Radio Milwaukee stories and 3 newest NPR stories/);
});

test('a keyword scan with no station and no home station stays NPR-only', async () => {
  const d = deps(); delete d.homeStation;
  const r = await findStories({ query: 'Angels' }, d);
  const scans = d.queries.filter((q) => !q.get('collectionIds')).map((q) => q.get('ownerHrefs'));
  assert.deepEqual(scans, ['https://organization.api.npr.org/v4/services/s1']);
  assert.match(r.searched, /over 3 newest NPR stories/);
});

test('station name becomes an owner filter and own-station hits are not marked display-only', async () => {
  const d = deps();
  const r = await findStories({ station: 'radio milwaukee', show: 'Ladies First' }, d);
  assert.equal(d.queries[0].get('ownerHrefs'), 'https://organization.api.npr.org/v4/services/s921');
  assert.equal(r.hits[0].rights, undefined);
});

test('another station\'s story is marked display-only with attribution', async () => {
  const r = await findStories({ query: 'Angels' }, deps());
  assert.equal(r.hits[0].rights, 'display-only: attribute via url, refresh regularly, do not store beyond display');
});

test('date window is passed through and limit caps the result', async () => {
  const d = deps();
  const r = await findStories({ query: 'AI', since: '2026-09-10', limit: 1 }, d);
  assert.equal(d.queries[0].get('publishDateTime'), '2026-09-10...');
  assert.equal(r.hits.length, 1);
});

test('a query with nothing to search is rejected plainly', async () => {
  await assert.rejects(() => findStories({}, deps()), /Give me at least one of/);
});

test('an unknown show is learned from the home station\'s newest stories, then found', async () => {
  const d = deps();
  let learned = false;
  d.catalog.findCollection = async (q) => (/ladies/i.test(q) && learned ? [{ id: 'g-s921-13049', title: 'Ladies First', type: 'series' }] : []);
  d.catalog.learnFromDocs = async (docs: any[]) => { if (docs.length) learned = true; return new Map(); };
  const r = await findStories({ show: 'Ladies First' }, d);
  assert.ok(learned, 'learned from a station scan');
  assert.equal(d.queries[0].get('ownerHrefs'), 'https://organization.api.npr.org/v4/services/s921', 'scan is scoped to the home station');
  assert.deepEqual(r.hits.map((h) => h.id), ['lf1', 'lf2']);
});

test('station only returns that station\'s newest stories with no collection filter', async () => {
  const d = deps();
  const r = await findStories({ station: 'radio milwaukee', limit: 2 }, d);
  assert.equal(d.queries.length, 1);
  assert.equal(d.queries[0].get('collectionIds'), null);
  assert.equal(d.queries[0].get('ownerHrefs'), 'https://organization.api.npr.org/v4/services/s921');
  assert.equal(r.hits.length, 2); assert.match(r.searched, /newest stories/);
});

test('kind=podcasts queries podcast episodes, excludes newscasts, and says so', async () => {
  const d = deps();
  const r = await findStories({ query: 'AI', kind: 'podcasts' }, d);
  const scan = d.queries.find((q) => !q.get('collectionIds'))!;
  assert.equal(scan.get('profileIds'), 'podcast-episode'); assert.equal(scan.get('excludedProfileIds'), 'newscast');
  assert.match(r.searched, /podcast/);
});

test('kind defaults to stories', async () => {
  const d = deps(); await findStories({ query: 'AI' }, d);
  assert.equal(d.queries[0].get('profileIds'), 'story'); assert.equal(d.queries[0].get('excludedProfileIds'), null);
});

test('a premium hit carries the premium note, and both notes when it is also another station\'s', async () => {
  const d = deps();
  const orig = d.cdsQuery;
  d.cdsQuery = async (p) => { const r = await orig(p); return { resources: r.resources.map((x: any) => ({ ...x, profiles: [{ href: '/v1/profiles/has-premium-audio', rels: ['interface'] }] })) }; };
  const r = await findStories({ query: 'Angels' }, d);
  assert.match(r.hits[0].rights!, /premium/); assert.match(r.hits[0].rights!, /display-only/);
  const own = await findStories({ station: 'radio milwaukee', show: 'Ladies First' }, d);
  assert.match(own.hits[0].rights!, /premium/); assert.doesNotMatch(own.hits[0].rights!, /display-only/);
});

test('an unknown podcast is learned from the station\'s newest podcast episodes', async () => {
  const d = deps(); let learned = false;
  d.catalog.findCollection = async (q) => (/bites/i.test(q) && learned ? [{ id: '718413877', title: 'This Bites', type: 'podcast-channel' }] : []);
  d.catalog.learnFromDocs = async (docs: any[]) => { if (docs.length) learned = true; return new Map(); };
  await findStories({ show: 'This Bites', kind: 'podcasts' }, d);
  assert.equal(d.queries[0].get('profileIds'), 'podcast-episode', 'the learning scan is a podcast scan');
  assert.equal(d.queries[0].get('ownerHrefs'), 'https://organization.api.npr.org/v4/services/s921');
});

test('show lookup asks for a podcast channel when kind=podcasts and avoids one otherwise', async () => {
  const d = deps(); const asked: any[] = [];
  d.catalog.findCollection = async (q, opts) => { asked.push(opts); return [{ id: 'g-s921-13049', title: q, type: 'series' }]; };
  await findStories({ show: 'Up First', kind: 'podcasts' }, d);
  await findStories({ show: 'Up First' }, d);
  assert.deepEqual(asked[0], { types: ['podcast-channel'] });
  assert.deepEqual(asked[1], { notTypes: ['podcast-channel'] });
});

test('an explicit show name is not satisfied by a fuzzy match that lacks its words', async () => {
  const d = deps();
  d.catalog.findCollection = async () => [{ id: '1070952742', title: 'first responders', type: 'tag' }];
  await assert.rejects(() => findStories({ show: 'Up First' }, d), /No show or collection matches "Up First"/);
});

test('a podcast show miss also learns from NPR\'s newest podcast episodes, not only the home station\'s', async () => {
  const d = deps(); const scanned: string[] = [];
  d.catalog.findCollection = async () => [];
  d.catalog.learnFromDocs = async () => new Map();
  const orig = d.cdsQuery;
  d.cdsQuery = async (p) => { if (p.get('profileIds') === 'podcast-episode' && !p.get('collectionIds')) scanned.push(p.get('ownerHrefs')!); return orig(p); };
  await findStories({ show: 'Up First', kind: 'podcasts' }, d).catch(() => {});
  assert.ok(scanned.some((o) => o.endsWith('/s921')) && scanned.some((o) => o.endsWith('/s1')), `scanned ${scanned.join(', ')}`);
});
