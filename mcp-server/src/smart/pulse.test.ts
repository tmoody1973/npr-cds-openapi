import { test } from 'node:test';
import assert from 'node:assert/strict';
import { networkPulse } from './pulse';

const ORG = 'https://organization.api.npr.org/v4/services/';
const COL = 'https://content.api.npr.org/v1/documents/';
const doc = (id: string, owner: string, date: string, collections: Array<[string, string]> = []) => ({
  id, title: `Title ${id}`, teaser: 'SECRET TEASER', publishDateTime: `${date}T10:00:00-05:00`,
  owners: [{ href: ORG + owner }],
  collections: collections.map(([cid, rel]) => ({ href: COL + cid, rels: [rel] })),
});

function deps(stories: any[], episodes: any[] = [], pageSize = 300) {
  const queries: URLSearchParams[] = [];
  return {
    queries,
    cdsQuery: async (p: URLSearchParams) => {
      queries.push(p);
      const pool = p.get('profileIds') === 'podcast-episode' ? episodes : stories;
      const off = Number(p.get('offset') ?? 0);
      return { resources: pool.slice(off, off + Math.min(pageSize, Number(p.get('limit') ?? 300))) };
    },
    catalog: {
      findStation: async () => [],
      findCollection: async () => [],
      learnFromDocs: async () => new Map([
        ['c-show', { id: 'c-show', title: 'Ladies First', type: 'series' }],
        ['c-atc', { id: 'c-atc', title: 'All Things Considered', type: 'program' }],
        ['c-pod', { id: 'c-pod', title: 'Up First', type: 'podcast-channel' }],
        ['c-housing', { id: 'c-housing', title: 'Housing', type: 'topic' }],
      ]),
      stations: async () => [{ id: 's1', name: 'NPR' }, { id: 's921', name: '88Nine Radio Milwaukee' }, { id: 's55', name: 'KCRW' }],
      enrichStation: async (id: string) => (id === 's55' ? { id, name: 'KCRW', city: 'Santa Monica', state: 'CA' } : { id, name: id }),
    },
    homeStation: 's921',
  };
}

test('counts stories per station, newest date wins, most stories first', async () => {
  const d = deps([
    doc('a', 's1', '2026-09-12'), doc('b', 's1', '2026-09-10'), doc('c', 's55', '2026-09-11'), doc('d', 's921', '2026-09-09'), doc('e', 's1', '2026-09-08'),
  ]);
  const r = await networkPulse({ since: '2026-09-06', until: '2026-09-13' }, d);
  assert.deepEqual(r.stations.map((s) => [s.id, s.name, s.count, s.last]), [
    ['s1', 'NPR', 3, '2026-09-12'], ['s55', 'KCRW', 1, '2026-09-11'], ['s921', '88Nine Radio Milwaukee', 1, '2026-09-09'],
  ]);
  assert.equal(r.stations[1].state, 'CA', 'city and state come from enrichStation when the finder knows them');
  assert.equal(r.scanned.stories, 5); assert.equal(r.capped, false);
  assert.equal(d.queries[0].get('publishDateTime'), '2026-09-06...2026-09-13');
  assert.equal(d.queries[0].get('ownerHrefs'), null, 'the scan is network-wide');
  assert.equal('coveredFrom' in r, false, 'an uncapped scan has no coveredFrom key');
});

test('shows and topics come from collections; podcast episodes count toward shows, not stations', async () => {
  const d = deps(
    [doc('a', 's921', '2026-09-12', [['c-show', 'series'], ['c-housing', 'topic']]), doc('b', 's1', '2026-09-11', [['c-atc', 'program'], ['c-housing', 'topic']]), doc('c', 's921', '2026-09-10', [['c-show', 'series']])],
    [doc('p1', 's1', '2026-09-12', [['c-pod', 'podcast-channel']]), doc('p2', 's1', '2026-09-11', [['c-pod', 'podcast-channel']])],
  );
  const r = await networkPulse({ since: '2026-09-06' }, d);
  assert.deepEqual(r.shows.map((s) => [s.id, s.name, s.rel, s.owner, s.count, s.last]), [
    ['c-show', 'Ladies First', 'series', 's921', 2, '2026-09-12'],
    ['c-pod', 'Up First', 'podcast-channel', 's1', 2, '2026-09-12'],
    ['c-atc', 'All Things Considered', 'program', 's1', 1, '2026-09-11'],
  ]);
  assert.deepEqual(r.topics, [{ id: 'c-housing', name: 'Housing', count: 2, last: '2026-09-12' }]);
  assert.deepEqual(r.stations.map((s) => [s.id, s.count]), [['s921', 2], ['s1', 1]], 'episodes do not count as station stories');
  assert.equal(r.scanned.episodes, 2);
});

test('pages the story scan up to depth and reports capped when the window holds more', async () => {
  const many = Array.from({ length: 700 }, (_, i) => doc(`s${i}`, 's1', `2026-09-${String(12 - Math.floor(i / 100)).padStart(2, '0')}`));
  const d = deps(many);
  const r = await networkPulse({ since: '2026-09-06', depth: 2 }, d);
  assert.equal(r.scanned.stories, 600); assert.equal(r.capped, true);
  assert.equal(r.coveredFrom, '2026-09-07', 'the oldest date among the SCANNED (first 600) documents, not the fixture as a whole');
  assert.match(r.searched, /raise depth/);
  assert.match(r.searched, /counts cover 2026-09-07 onward/);
  assert.deepEqual(d.queries.filter((q) => q.get('profileIds') === 'story').map((q) => q.get('offset')), ['0', '300']);
});

test('NPR is named by NPR_SERVICE_ID, whatever the directory calls it', async () => {
  const d = deps([doc('a', 's1', '2026-09-12')]);
  d.catalog.stations = async () => [{ id: 's1', name: 'NPR Service' }];
  const r = await networkPulse({ since: '2026-09-06' }, d);
  assert.equal(r.stations[0].id, 's1');
  assert.equal(r.stations[0].name, 'NPR');
});

test('with no depth argument, the default of 6 pages the story scan to six offsets', async () => {
  const many = Array.from({ length: 2000 }, (_, i) => doc(`s${i}`, 's1', '2026-09-12'));
  const d = deps(many);
  const r = await networkPulse({ since: '2026-09-06' }, d);
  assert.deepEqual(d.queries.filter((q) => q.get('profileIds') === 'story').map((q) => q.get('offset')), ['0', '300', '600', '900', '1200', '1500']);
  assert.equal(r.capped, true);
});

test('episode scan pages to depth, like the story scan', async () => {
  const many = Array.from({ length: 700 }, (_, i) => doc(`e${i}`, 's1', '2026-09-12'));
  const d = deps([], many);
  await networkPulse({ since: '2026-09-06', depth: 2 }, d);
  assert.deepEqual(
    d.queries.filter((q) => q.get('profileIds') === 'podcast-episode').map((q) => q.get('offset')),
    ['0', '300'],
  );
});

test('episodes capped, stories not: coveredFrom comes from the episode window, and an older story is trimmed out', async () => {
  const episodeDate = (i: number) => `2026-09-${String(12 - Math.floor(i / 100)).padStart(2, '0')}`;
  const episodes = Array.from({ length: 301 }, (_, i) => doc(`e${i}`, 's1', episodeDate(i)));
  const stories = [doc('old', 's-old', '2026-09-05'), doc('a', 's1', '2026-09-12')];
  const d = deps(stories, episodes);
  const r = await networkPulse({ since: '2026-09-01', depth: 1 }, d);
  assert.equal(r.scanned.episodes, 300, 'depth 1 reads exactly one 300-page');
  assert.equal(r.capped, true);
  assert.equal(r.coveredFrom, '2026-09-10', "the episode scan's oldest SCANNED date, since stories were not capped");
  assert.equal(r.stations.find((s) => s.id === 's-old'), undefined, 'a story older than coveredFrom is trimmed from its station tally');
  assert.deepEqual(r.stations.map((s) => s.id), ['s1']);
});

test('both scans capped: coveredFrom is the later of the two oldest dates, and a story between them is trimmed', async () => {
  const storyDate = (i: number) => `2026-09-${String(12 - Math.floor(i / 100)).padStart(2, '0')}`;
  const episodeDate = (i: number) => `2026-09-${String(14 - Math.floor(i / 100)).padStart(2, '0')}`;
  const stories = [
    doc('mid', 's-mid', '2026-09-08'),
    ...Array.from({ length: 599 }, (_, i) => doc(`s${i}`, 's1', storyDate(i))),
  ];
  const episodes = Array.from({ length: 600 }, (_, i) => doc(`e${i}`, 's1', episodeDate(i)));
  const d = deps(stories, episodes);
  const r = await networkPulse({ since: '2026-09-01', depth: 2 }, d);
  assert.equal(r.capped, true);
  assert.equal(r.coveredFrom, '2026-09-09', 'the later (more recent) of the stories oldest (09-07) and episodes oldest (09-09)');
  assert.equal(r.stations.find((s) => s.id === 's-mid'), undefined, 'the 09-08 story falls before coveredFrom and is trimmed');
});

test('since defaults to seven days ago and limit caps shows and topics', async () => {
  const shows = Array.from({ length: 5 }, (_, i) => [`c-show`, 'series'] as [string, string]);
  const d = deps([doc('a', 's1', '2026-09-12', shows), doc('b', 's1', '2026-09-12', [['c-atc', 'program']]), doc('c', 's1', '2026-09-12', [['c-housing', 'topic']])]);
  const r = await networkPulse({ limit: 1 }, d);
  assert.match(r.since, /^\d{4}-\d{2}-\d{2}$/);
  const sevenDays = 7 * 24 * 3600 * 1000;
  assert.ok(Math.abs(Date.now() - sevenDays - Date.parse(`${r.since}T00:00:00Z`)) < 2 * 24 * 3600 * 1000);
  assert.equal(r.shows.length, 1); assert.equal(r.topics.length, 1);
});

test('the result carries no story text', async () => {
  const r = await networkPulse({ since: '2026-09-06' }, deps([doc('a', 's1', '2026-09-12', [['c-show', 'series']])]));
  const json = JSON.stringify(r);
  assert.ok(!json.includes('SECRET TEASER')); assert.ok(!json.includes('Title a')); assert.ok(!/"url"/.test(json));
});

test('a collection link to /null and byline links are ignored', async () => {
  const d = deps([{ ...doc('a', 's1', '2026-09-12'), collections: [{ href: COL + 'null', rels: ['topic'] }, { href: COL + 'p-1', rels: ['byline'] }] }]);
  const r = await networkPulse({ since: '2026-09-06' }, d);
  assert.deepEqual(r.topics, []); assert.deepEqual(r.shows, []);
});

test('a station whose enrichStation lookup throws still gets a row, by directory name, uncrashed', async () => {
  const d = deps([doc('a', 's55', '2026-09-12'), doc('b', 's1', '2026-09-11')]);
  d.catalog.enrichStation = async (id: string) => { if (id === 's55') throw new Error('finder down'); return { id, name: id }; };
  const r = await networkPulse({ since: '2026-09-06' }, d);
  const kcrw = r.stations.find((s) => s.id === 's55');
  assert.deepEqual({ name: kcrw?.name, count: kcrw?.count, last: kcrw?.last }, { name: 'KCRW', count: 1, last: '2026-09-12' });
  assert.equal(kcrw?.state, undefined, 'no state: the finder never answered');
});

test('a cdsQuery rejection fails networkPulse with the same error, for safe() to turn into a tool error', async () => {
  const d = deps([doc('a', 's1', '2026-09-12')]);
  d.cdsQuery = async () => { throw new Error('CDS 503 for /v1/documents'); };
  await assert.rejects(networkPulse({ since: '2026-09-06' }, d), /CDS 503 for \/v1\/documents/);
});

test('a window with no stories and no episodes comes back empty, uncapped, with no coveredFrom key', async () => {
  const d = deps([]);
  const r = await networkPulse({ since: '2026-09-06' }, d);
  assert.deepEqual(r.stations, []); assert.deepEqual(r.shows, []); assert.deepEqual(r.topics, []);
  assert.equal(r.capped, false);
  assert.equal('coveredFrom' in r, false);
});
