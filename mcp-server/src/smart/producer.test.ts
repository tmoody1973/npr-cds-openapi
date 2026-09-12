import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStory, stationLabels, whatsNewSince } from './producer';

const RM = 'https://organization.api.npr.org/v4/services/s921';
const full = (over: any = {}) => ({
  id: 'g-s921-15973', title: 'Ladies First: Blessing Jolie', teaser: 'Raised in Texas.',
  publishDateTime: '2026-09-04T12:20:50-05:00', editorialLastModifiedDateTime: '2026-09-11T11:23:40-05:00',
  owners: [{ href: RM }],
  webPages: [{ href: 'https://radiomilwaukee.org/show/ladies-first/2026-09-04/blessing-jolie', rels: ['canonical'] }],
  collections: [
    { href: '/v1/documents/g-s921-13049', rels: ['series'] },
    { href: '/v1/documents/g-s921-16131', rels: ['category'] },
    { href: '/v1/documents/g-s921-4166', rels: ['topic'] },
    { href: '/v1/documents/g-s921-6879', rels: ['tag'] },
    { href: '/v1/documents/1192772937', rels: ['byline'] },
  ],
  audio: [{ href: '#/assets/a1', rels: ['primary'] }],
  images: [{ href: '#/assets/i1', rels: ['primary'] }],
  assets: { a1: { duration: 1397, enclosures: [{ href: 'https://dovetail/x.mp3', type: 'audio/mpeg' }] }, i1: { enclosures: [{ href: 'https://img/x.jpg' }] } },
  ...over,
});
const names: Record<string, { title: string; type: string }> = {
  'g-s921-13049': { title: 'Ladies First', type: 'series' }, 'g-s921-16131': { title: 'HYFIN', type: 'category' },
  'g-s921-4166': { title: 'New Music', type: 'topic' }, 'g-s921-6879': { title: 'On Vinyl', type: 'tag' },
};

function deps(docs: any[] = [full()]) {
  const queries: URLSearchParams[] = [];
  return {
    queries,
    cdsQuery: async (p: URLSearchParams) => {
      queries.push(p);
      const ids = p.get('ids');
      if (ids) return { resources: docs.filter((d) => ids.split(',').includes(d.id)) };
      return { resources: docs };
    },
    catalog: {
      findStation: async (q: string) => (/milwaukee|s921/i.test(q) ? [{ id: 's921', name: '88Nine Radio Milwaukee' }] : /kcrw/i.test(q) ? [{ id: 's55', name: 'KCRW' }] : []),
      findCollection: async () => [],
      learnFromDocs: async (ds: any[]) => new Map(ds.flatMap((d) => d.collections.map((l: any) => l.href.replace(/^.*\//, ''))).filter((id: string) => names[id]).map((id: string) => [id, { id, ...names[id] }])),
    },
    homeStation: 's921',
  };
}

// ---- check_story ----
test('check_story by id reports labels, audio, image, teaser and no problems', async () => {
  const r = await checkStory({ id: 'g-s921-15973' }, deps());
  assert.equal(r.found, true); assert.equal(r.show, 'Ladies First');
  assert.deepEqual(r.topics, ['New Music']); assert.deepEqual(r.tags, ['On Vinyl']); assert.deepEqual(r.categories, ['HYFIN']);
  assert.equal(r.audio?.seconds, 1397); assert.equal(r.primaryImage, true); assert.equal(r.teaser, true);
  assert.deepEqual(r.problems, []);
});

test('check_story by npr.org url extracts the id', async () => {
  const d = deps([full({ id: 'nx-s1-5950588' })]);
  const r = await checkStory({ url: 'https://www.npr.org/2026/09/12/nx-s1-5950588/openai-anthropic-ai-safety' }, d);
  assert.equal(r.found, true); assert.equal(d.queries[0].get('ids'), 'nx-s1-5950588');
});

test('check_story by station url scans the home station and matches the canonical url', async () => {
  const d = deps();
  const r = await checkStory({ url: 'https://radiomilwaukee.org/show/ladies-first/2026-09-04/blessing-jolie?utm=x' }, d);
  assert.equal(r.found, true); assert.equal(r.id, 'g-s921-15973');
  assert.equal(d.queries[0].get('ownerHrefs'), RM);
});

test('check_story lists problems in editor-guide language', async () => {
  const bare = full({ teaser: undefined, audio: [], images: [], collections: [{ href: '/v1/documents/g-s921-4166', rels: ['topic'] }] });
  const r = await checkStory({ id: 'g-s921-15973' }, deps([bare]));
  assert.deepEqual(r.problems, [
    'No Show set. Grove finds show episodes by the Show label.',
    'No audio attached in Brightspot. The story will show without a player.',
    'No primary image. The list thumbnail and header will be blank.',
    'No teaser. The line under the title on the list page will be empty.',
  ]);
});

test('check_story not found says what was scanned', async () => {
  const r = await checkStory({ url: 'https://radiomilwaukee.org/show/ladies-first/2026-09-20/nope' }, deps());
  assert.equal(r.found, false);
  assert.match(r.problems[0], /Not in CDS/); assert.match(r.problems[0], /five minutes/);
  assert.match(r.searched, /newest 1 stories from 88Nine Radio Milwaukee/);
});

// ---- station_labels ----
test('station_labels groups collections by kind with counts and names', async () => {
  const docs = [full(), full({ id: 'x2', collections: [{ href: '/v1/documents/g-s921-13049', rels: ['series'] }, { href: '/v1/documents/g-s921-6879', rels: ['tag'] }] })];
  const r = await stationLabels({ station: 'Radio Milwaukee' }, deps(docs));
  assert.equal(r.station.id, 's921'); assert.equal(r.scanned, 2);
  assert.deepEqual(r.shows, [{ id: 'g-s921-13049', name: 'Ladies First', count: 2 }]);
  assert.deepEqual(r.tags, [{ id: 'g-s921-6879', name: 'On Vinyl', count: 2 }]);
  assert.deepEqual(r.topics, [{ id: 'g-s921-4166', name: 'New Music', count: 1 }]);
  assert.deepEqual(r.categories, [{ id: 'g-s921-16131', name: 'HYFIN', count: 1 }]);
});

test('station_labels keeps an unnamed collection with its id so nothing is hidden', async () => {
  const r = await stationLabels({ station: 'Radio Milwaukee' }, deps([full({ collections: [{ href: '/v1/documents/g-s921-999', rels: ['tag'] }] })]));
  assert.deepEqual(r.tags, [{ id: 'g-s921-999', name: 'g-s921-999', count: 1 }]);
});

// ---- whats_new_since ----
test('whats_new_since filters on editorial modified time, newest change first, and marks new vs updated', async () => {
  const docs = [
    full({ id: 'old-updated', publishDateTime: '2026-09-01T09:00:00-05:00', editorialLastModifiedDateTime: '2026-09-12T09:00:00-05:00' }),
    full({ id: 'brand-new', publishDateTime: '2026-09-12T10:00:00-05:00', editorialLastModifiedDateTime: '2026-09-12T10:00:00-05:00' }),
  ];
  const d = deps(docs);
  const r = await whatsNewSince({ since: '2026-09-12T08:00:00Z' }, d);
  assert.equal(d.queries[0].get('editorialLastModifiedDateTime'), '2026-09-12T08:00:00Z...');
  assert.equal(d.queries[0].get('sort'), 'editorialLastModifiedDateTime:desc');
  assert.equal(d.queries[0].get('ownerHrefs'), RM, 'defaults to the home station');
  assert.deepEqual(r.hits.map((h) => [h.id, h.change]), [['brand-new', 'new'], ['old-updated', 'updated']]);
  assert.equal(r.hits[0].modified, '2026-09-12T10:00:00-05:00');
});

test('whats_new_since accepts a station and falls back to NPR with no home station', async () => {
  const d = deps(); await whatsNewSince({ since: '2026-09-12', station: 'KCRW' }, d);
  assert.equal(d.queries[0].get('ownerHrefs'), 'https://organization.api.npr.org/v4/services/s55');
  const d2 = { ...deps(), homeStation: undefined }; await whatsNewSince({ since: '2026-09-12' }, d2);
  assert.equal(d2.queries[0].get('ownerHrefs'), 'https://organization.api.npr.org/v4/services/s1');
});

test('station_labels ignores collection links whose id is literally "null"', async () => {
  const r = await stationLabels({ station: 'Radio Milwaukee' }, deps([full({ collections: [{ href: '/v1/documents/null', rels: ['topic'] }, { href: '/v1/documents/g-s921-4166', rels: ['topic'] }] })]));
  assert.deepEqual(r.topics.map((t) => t.id), ['g-s921-4166']);
});

test('whats_new_since reads a bare date the way CDS does, as US Eastern midnight', async () => {
  // Published 2026-09-11 at 11pm Eastern: before a since of 2026-09-12, so "updated", not "new".
  const docs = [full({ id: 'late-night', publishDateTime: '2026-09-11T23:00:00-05:00', editorialLastModifiedDateTime: '2026-09-12T09:00:00-05:00' })];
  const r = await whatsNewSince({ since: '2026-09-12' }, deps(docs));
  assert.equal(r.hits[0].change, 'updated');
});

test('a home station that is not in the directory is a config error, not "not in CDS"', async () => {
  const d = { ...deps(), homeStation: 's999999' };
  await assert.rejects(() => checkStory({ url: 'https://radiomilwaukee.org/show/x/y' }, d), /NPR_CDS_HOME_STATION/);
});

test('check_story matches a station url regardless of www', async () => {
  const r = await checkStory({ url: 'https://www.radiomilwaukee.org/show/ladies-first/2026-09-04/blessing-jolie/' }, deps());
  assert.equal(r.found, true);
});

test('check_story counts a program as the show', async () => {
  const doc = full({ collections: [{ href: '/v1/documents/2', rels: ['program'] }] });
  const d = deps([doc]);
  d.catalog.learnFromDocs = async () => new Map([['2', { id: '2', title: 'All Things Considered', type: 'program' }]]);
  const r = await checkStory({ id: 'g-s921-15973' }, d);
  assert.equal(r.show, 'All Things Considered'); assert.ok(!r.problems.some((p) => /No Show/.test(p)));
});

test('check_story only treats real npr.org hosts as npr.org urls', async () => {
  const d = deps();
  await checkStory({ url: 'https://evilnpr.org/2026/09/12/nx-s1-1/slug' }, d).catch(() => {});
  assert.equal(d.queries[0]?.get('ids'), null, 'must not extract an id from a look-alike host');
});
