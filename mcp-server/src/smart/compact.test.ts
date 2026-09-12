import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toHit } from './compact';
import { matches } from './match';

// Trimmed from a real CDS story (g-s921-15973) so the shape is honest.
const doc = {
  id: 'g-s921-15973',
  title: 'Ladies First: Blessing Jolie',
  teaser: 'Raised in <em>Texas</em>, Jolie shares a 20-something perspective.',
  publishDateTime: '2026-09-04T12:20:50.952-05:00',
  owners: [{ href: 'https://organization.api.npr.org/v4/services/s921' }],
  webPages: [{ href: 'https://radiomilwaukee.org/show/ladies-first/2026-09-04/blessing-jolie', rels: ['canonical'] }],
  collections: [
    { href: '/v1/documents/g-s921-13049', rels: ['series'] },
    { href: '/v1/documents/1192772937', rels: ['byline'] },
  ],
  audio: [{ href: '#/assets/g-s921-15974', rels: ['primary'] }],
  assets: {
    'g-s921-15974': { duration: 1397, enclosures: [{ href: 'https://dovetail.prxu.org/x.mp3', type: 'audio/mpeg' }] },
  },
};

test('toHit keeps id, title, date, url and strips html from the teaser', () => {
  const h = toHit(doc);
  assert.equal(h.id, 'g-s921-15973');
  assert.equal(h.title, 'Ladies First: Blessing Jolie');
  assert.equal(h.date, '2026-09-04');
  assert.equal(h.url, 'https://radiomilwaukee.org/show/ladies-first/2026-09-04/blessing-jolie');
  assert.equal(h.teaser, 'Raised in Texas, Jolie shares a 20-something perspective.');
});

test('toHit carries audio seconds and stream link', () => {
  const h = toHit(doc);
  assert.deepEqual(h.audio, { seconds: 1397, href: 'https://dovetail.prxu.org/x.mp3' });
});

test('toHit lists collections with rel, skipping bylines, and the owner service id', () => {
  const h = toHit(doc);
  assert.deepEqual(h.collections, [{ id: 'g-s921-13049', rel: 'series' }]);
  assert.equal(h.owner, 's921');
});

test('toHit stays small', () => {
  assert.ok(JSON.stringify(toHit(doc)).length < 600);
});

test('toHit survives a document with no teaser, audio, or web page', () => {
  const h = toHit({ id: 'x', title: 't', publishDateTime: '2026-01-01T00:00:00Z', owners: [] });
  assert.equal(h.audio, undefined);
  assert.equal(h.url, undefined);
  assert.equal(h.teaser, undefined);
});

test('matches requires every term at a word start in title or teaser', () => {
  const h = toHit(doc);
  assert.ok(matches(h, 'jolie'));
  assert.ok(matches(h, 'Blessing perspective'));
  assert.ok(!matches(h, 'ing'), 'substring inside a word must not match');
  assert.ok(!matches(h, 'jolie sudan'), 'all terms must match');
});

test('matches treats "AI" as a word, not the middle of "said"', () => {
  const h = toHit({ ...doc, title: 'She said hello', teaser: 'nothing' });
  assert.ok(!matches(h, 'AI'));
  assert.ok(matches(toHit({ ...doc, title: 'AI is here' }), 'ai'));
});

test('matches: short terms are whole words, longer terms may be prefixes', () => {
  const h = toHit({ ...doc, title: 'Airport art returns', teaser: 'AIDS stigma; aimed at airlines' });
  assert.ok(!matches(h, 'AI'), '"AI" must not match Airport, AIDS, aimed, airlines');
  assert.ok(matches(toHit({ ...doc, title: 'Anthropic model' }), 'anthrop'), 'longer terms still match as a prefix');
});

test('toHit keeps at most five collections, shows and programs before topics and tags', () => {
  const rels = ['episode', 'topic', 'tag', 'collection', 'program', 'topic', 'series', 'tag', 'topic'];
  const h = toHit({ ...doc, collections: rels.map((rel, i) => ({ href: `/v1/documents/${rel}${i}`, rels: [rel] })) });
  assert.equal(h.collections.length, 5);
  assert.deepEqual(h.collections.slice(0, 2).map((c) => c.rel), ['series', 'program']);
});

test('toHit prefers the audio entry marked primary over the first one listed', () => {
  const h = toHit({ ...doc,
    audio: [{ href: '#/assets/promo', rels: ['promo'] }, { href: '#/assets/g-s921-15974', rels: ['primary'] }],
    assets: { ...doc.assets, promo: { duration: 30, enclosures: [{ href: 'https://x/promo.mp3', type: 'audio/mpeg' }] } } });
  assert.equal(h.audio?.href, 'https://dovetail.prxu.org/x.mp3');
});
