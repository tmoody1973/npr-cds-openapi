import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverageGap, coverageScan, searchArchive, titleOverlap } from './coverage';

const ORG = 'https://organization.api.npr.org/v4/services/';
const story = (id: string, title: string, date: string, owner = 's1') => ({
  id, title, teaser: '', publishDateTime: `${date}T10:00:00-05:00`, owners: [{ href: ORG + owner }],
  webPages: [{ href: `https://x/${id}`, rels: ['canonical'] }], collections: [],
});

function deps(byOwner: Record<string, any[]>, all: any[] = []) {
  const queries: URLSearchParams[] = [];
  return {
    queries,
    cdsQuery: async (p: URLSearchParams) => {
      queries.push(p);
      const owner = p.get('ownerHrefs')?.replace(ORG, '');
      const pool = owner ? (byOwner[owner] ?? []) : all;
      const range = p.get('publishDateTime');
      let docs = pool;
      if (range) { const [from, to] = range.split('...'); docs = pool.filter((d) => (!from || d.publishDateTime >= from) && (!to || d.publishDateTime.slice(0, 10) <= to)); }
      return { resources: docs.slice(Number(p.get('offset') ?? 0), Number(p.get('offset') ?? 0) + Number(p.get('limit') ?? 300)) };
    },
    catalog: {
      findStation: async (q: string) => (/milwaukee|s921/i.test(q) ? [{ id: 's921', name: '88Nine Radio Milwaukee' }] : /kcrw|s55/i.test(q) ? [{ id: 's55', name: 'KCRW' }] : /npr|s1$/i.test(q) ? [{ id: 's1', name: 'NPR' }] : []),
      findCollection: async () => [],
      learnFromDocs: async () => new Map(),
      stations: async () => [{ id: 's1', name: 'NPR' }, { id: 's921', name: '88Nine Radio Milwaukee' }, { id: 's55', name: 'KCRW' }, { id: 's715', name: 'WXPN' }],
    },
    homeStation: 's921',
  };
}

// ---- search_archive ----
test('search_archive walks half-year windows newest first and stops at the limit', async () => {
  const d = deps({ s921: [story('a', 'Summerfest 2026 lineup', '2026-06-20', 's921'), story('b', 'Summerfest 2024 recap', '2024-07-02', 's921'), story('c', 'Summerfest 2023 photos', '2023-06-28', 's921'), story('d', 'Unrelated', '2023-01-05', 's921')] });
  const r = await searchArchive({ query: 'Summerfest', station: 'Radio Milwaukee', from: '2023-01-01', to: '2026-09-12', limit: 2 }, d);
  assert.deepEqual(r.hits.map((h) => h.id), ['a', 'b']);
  assert.equal(d.queries[0].get('publishDateTime'), '2026-03-13...2026-09-12', 'first window is the newest half-year');
  assert.ok(r.windowsScanned >= 2 && r.windowsScanned <= 5, `scanned ${r.windowsScanned}`);
  assert.match(r.searched, /windows/);
});

test('search_archive caps the number of windows and says so', async () => {
  const d = deps({ s921: [] });
  const r = await searchArchive({ query: 'nothing', station: 'Radio Milwaukee', from: '2005-01-01', to: '2026-09-12' }, d);
  assert.ok(r.windowsScanned <= 12); assert.match(r.note ?? '', /oldest window reached was/i);
});

test('search_archive defaults station to home and kind to stories', async () => {
  const d = deps({ s921: [] });
  await searchArchive({ query: 'x', from: '2026-01-01', to: '2026-09-12' }, d);
  assert.equal(d.queries[0].get('ownerHrefs'), ORG + 's921'); assert.equal(d.queries[0].get('profileIds'), 'story');
});

// ---- coverage_scan ----
test('coverage_scan groups hits by station name across NPR and the network', async () => {
  const d = deps({ s1: [story('n1', 'Housing costs climb', '2026-09-10', 's1')] }, [story('k1', 'LA housing vote', '2026-09-11', 's55'), story('w1', 'Philly housing plan', '2026-09-11', 's715'), story('z1', 'Zoo opens', '2026-09-11', 's55')]);
  const r = await coverageScan({ topic: 'housing', since: '2026-09-08' }, d);
  const names = r.byStation.map((g) => g.station.name);
  assert.deepEqual(names.sort(), ['88Nine Radio Milwaukee', 'KCRW', 'NPR', 'WXPN'].filter((n) => n !== '88Nine Radio Milwaukee').sort());
  assert.equal(r.byStation.find((g) => g.station.id === 's55')!.hits.length, 1);
  assert.match(r.searched, /NPR/); assert.match(r.searched, /network/);
});

test('coverage_scan can be limited to named stations', async () => {
  const d = deps({ s55: [story('k1', 'LA housing vote', '2026-09-11', 's55')], s921: [story('m1', 'Milwaukee housing', '2026-09-11', 's921')] });
  const r = await coverageScan({ topic: 'housing', since: '2026-09-08', stations: ['KCRW', 'Radio Milwaukee'] }, d);
  assert.deepEqual(r.byStation.map((g) => g.station.id).sort(), ['s55', 's921']);
  assert.ok(!d.queries.some((q) => !q.get('ownerHrefs')), 'no all-network scan when stations are named');
});

// ---- coverage_gap ----
test('titleOverlap ignores stopwords and short words', () => {
  assert.equal(titleOverlap('The housing crisis in Milwaukee', 'Milwaukee housing costs climb'), 2);
  assert.equal(titleOverlap('A day at the zoo', 'The day is long'), 0);
});

test('coverage_gap marks NPR stories localized or not against home station stories', async () => {
  const d = deps({
    s1: [story('n1', 'Housing costs climb across the Midwest', '2026-09-10', 's1'), story('n2', 'Child care subsidies gain bipartisan support', '2026-09-11', 's1')],
    s921: [story('m1', 'Milwaukee housing costs: what renters face', '2026-09-11', 's921')],
  });
  const r = await coverageGap({ topic: 'housing', since: '2026-09-08' }, d);
  assert.equal(r.npr.length, 1, 'keyword scan keeps only housing stories');
  assert.equal(r.npr[0].localized?.id, 'm1');
  const r2 = await coverageGap({ topic: 'child care', since: '2026-09-08' }, d);
  assert.equal(r2.npr[0].localized, undefined);
  assert.match(r2.npr[0].gap!, /not localized/i);
  assert.equal(r2.ours.length, 0);
});
