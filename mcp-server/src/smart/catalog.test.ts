import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Catalog, type FetchJson } from './catalog';

const topic = (id: string, title: string) => ({ id, title, profiles: [{ href: '/v1/profiles/topic', rels: ['type'] }] });

function fakeNet() {
  const calls: string[] = [];
  const fetchJson: FetchJson = async (url) => {
    calls.push(url);
    if (url.startsWith('https://organization.api.npr.org/v4/services')) return [{ id: 's55', name: 'KCRW' }, { id: 's715', name: 'WXPN' }, { id: 's921', name: '88Nine Radio Milwaukee' }];
    if (url.startsWith('https://station.api.npr.org/v3/stations?q=')) {
      const q = decodeURIComponent(url.split('?q=')[1]);
      if (/kcrw/i.test(q)) return { items: [{ attributes: { serviceId: 's55', brand: { call: 'KCRW', name: 'KCRW', marketCity: 'Santa Monica', marketState: 'CA', band: 'FM' }, eligibility: { musicOnly: false } } }] };
      if (/nowhere/i.test(q)) return { items: [] };
      return { items: [{ attributes: { serviceId: 's715', brand: { call: 'XPN', name: 'WXPN', marketCity: 'Philadelphia', marketState: 'PA', band: 'FM' }, eligibility: { musicOnly: true } } }] };
    }
    const u = new URL(url);
    // station series ids are not published documents, so CDS returns nothing for them
    if (u.searchParams.get('ids')) return { resources: u.searchParams.get('ids')!.split(',').filter((id) => !id.startsWith('g-s921-')).map((id) => topic(id, `Title ${id}`)) };
    if (u.searchParams.get('profileIds') === 'topic') return { resources: [topic('1019', 'Technology'), topic('133775819', 'Artificial Intelligence')] };
    if (u.searchParams.get('profileIds') === 'program') return { resources: [{ id: '2', title: 'All Things Considered', profiles: [{ href: '/v1/profiles/program', rels: ['type'] }] }, { id: '3', title: 'Up First', profiles: [{ href: '/v1/profiles/program', rels: ['type'] }] }] };
    if (u.searchParams.get('profileIds') === 'podcast-channel') return { resources: [{ id: '510318', title: 'Up First', profiles: [{ href: '/v1/profiles/podcast-channel', rels: ['type'] }] }] };
    return { resources: [] };
  };
  return { fetchJson, calls };
}
const dir = () => mkdtempSync(path.join(tmpdir(), 'cds-catalog-'));

test('stations are fetched once and served from disk afterwards', async () => {
  const d = dir(); const net = fakeNet();
  const a = await new Catalog(net.fetchJson, d).stations();
  const b = await new Catalog(net.fetchJson, d).stations();
  assert.equal(a.length, 3); assert.deepEqual(a, b);
  assert.equal(net.calls.filter((u) => u.includes('organization.api')).length, 1);
});

test('findStation matches call letters loosely from the directory', async () => {
  const c = new Catalog(fakeNet().fetchJson, dir());
  assert.equal((await c.findStation('kcrw'))[0].id, 's55');
  assert.equal((await c.findStation('Radio Milwaukee'))[0].id, 's921');
});

test('findStation falls back to the station finder for a city name', async () => {
  const c = new Catalog(fakeNet().fetchJson, dir());
  const r = await c.findStation('Philadelphia');
  assert.equal(r[0].id, 's715'); assert.equal(r[0].city, 'Philadelphia');
});

test('resolveCollections fetches unknown ids in batches of 50 and remembers them', async () => {
  const d = dir(); const net = fakeNet();
  const ids = Array.from({ length: 120 }, (_, i) => `c${i}`);
  const m = await new Catalog(net.fetchJson, d).resolveCollections(ids);
  assert.equal(m.size, 120); assert.equal(m.get('c7')?.title, 'Title c7'); assert.equal(m.get('c7')?.type, 'topic');
  assert.equal(net.calls.filter((u) => u.includes('ids=')).length, 3);
  await new Catalog(net.fetchJson, d).resolveCollections(['c7', 'c8']);
  assert.equal(net.calls.filter((u) => u.includes('ids=')).length, 3, 'second instance reads the disk cache');
});

test('findCollection seeds NPR topics and programs, then fuzzy-matches by name', async () => {
  const c = new Catalog(fakeNet().fetchJson, dir());
  assert.equal((await c.findCollection('artificial intelligence'))[0].id, '133775819');
  assert.equal((await c.findCollection('all things considerd'))[0].id, '2');
  assert.equal((await c.findCollection('zzzz')).length, 0);
});

test('learnFromDocs infers a station show name from the story url when the series id is not fetchable', async () => {
  const net = fakeNet();
  const c = new Catalog(net.fetchJson, dir());
  await c.learnFromDocs([{
    id: 'g-s921-15973', title: 'Ladies First: Blessing Jolie',
    webPages: [{ href: 'https://radiomilwaukee.org/show/ladies-first/2026-09-04/blessing-jolie', rels: ['canonical'] }],
    collections: [{ href: '/v1/documents/g-s921-13049', rels: ['series'] }, { href: '/v1/documents/1192772937', rels: ['byline'] }],
  }]);
  const [hit] = await c.findCollection('ladies first');
  assert.equal(hit?.id, 'g-s921-13049'); assert.equal(hit?.type, 'series');
  assert.ok(!net.calls.some((u) => u.includes('1192772937')), 'bylines are not resolved');
});

test('learnFromDocs keeps a later story\'s /show/ slug when the first story had none', async () => {
  const c = new Catalog(fakeNet().fetchJson, dir());
  const series = [{ href: '/v1/documents/g-s921-13049', rels: ['series'] }];
  await c.learnFromDocs([
    { id: 'a', webPages: [{ href: 'https://radiomilwaukee.org/2026/09/04/no-show-path', rels: ['canonical'] }], collections: series },
    { id: 'b', webPages: [{ href: 'https://radiomilwaukee.org/show/ladies-first/2026-09-11/x', rels: ['canonical'] }], collections: series },
  ]);
  assert.equal((await c.findCollection('ladies first'))[0]?.id, 'g-s921-13049');
});

test('findCollection knows NPR podcast channels from the seed', async () => {
  const c = new Catalog(fakeNet().fetchJson, dir());
  const hits = await c.findCollection('up first');
  assert.ok(hits.some((h) => h.id === '510318' && h.type === 'podcast-channel'), 'the podcast channel is in the unfiltered results');
});

test('findCollection can be limited to, or kept away from, a collection type', async () => {
  const c = new Catalog(fakeNet().fetchJson, dir());
  assert.equal((await c.findCollection('up first', { types: ['podcast-channel'] }))[0]?.id, '510318', 'the podcast');
  assert.equal((await c.findCollection('up first', { notTypes: ['podcast-channel'] }))[0]?.id, '3', 'the broadcast program');
});

test('a catalog seeded by an older version re-seeds when the seed list changes', async () => {
  const d = dir(); const net = fakeNet();
  const first = new Catalog(net.fetchJson, d);
  await first.findCollection('technology');
  // pretend an older release wrote the cache without podcast channels and without a seed version
  const file = path.join(d, 'collections.json');
  const state = JSON.parse(readFileSync(file, 'utf8'));
  delete state.seedVersion; delete state.items['510318'];
  writeFileSync(file, JSON.stringify(state));
  const again = new Catalog(net.fetchJson, d);
  assert.ok((await again.findCollection('up first', { types: ['podcast-channel'] })).some((h) => h.id === '510318'), 're-seeded podcast channels');
});

test('the finder fallback carries state, band and the music-only flag', async () => {
  const c = new Catalog(fakeNet().fetchJson, dir());
  const [r] = await c.findStation('Philadelphia');
  assert.deepEqual({ state: r.state, band: r.band, musicOnly: r.musicOnly }, { state: 'PA', band: 'FM', musicOnly: true });
});

test('enrichStation looks a directory station up in the finder by name once, caches it, and leaves an unknown one as it was', async () => {
  const net = fakeNet(); const d = dir();
  const c = new Catalog(net.fetchJson, d);
  const a = await c.enrichStation('s55');
  assert.deepEqual({ id: a.id, city: a.city, state: a.state, musicOnly: a.musicOnly }, { id: 's55', city: 'Santa Monica', state: 'CA', musicOnly: false });
  const finderCalls = () => net.calls.filter((u) => u.includes('station.api')).length;
  const n = finderCalls();
  await c.enrichStation('s55');
  await new Catalog(net.fetchJson, d).enrichStation('s55'); // a fresh process reads the cache
  assert.equal(finderCalls(), n, 'no second finder call');
  const missing = await new Catalog(async (u) => (u.includes('organization.api') ? [{ id: 's999', name: 'Radio Nowhere' }] : { items: [] }), dir()).enrichStation('s999');
  assert.deepEqual(missing, { id: 's999', name: 'Radio Nowhere' });
});
