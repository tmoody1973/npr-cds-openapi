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

test('toHit decodes html entities in the teaser', () => {
  assert.equal(toHit({ ...doc, teaser: 'AT&amp;T &quot;deal&quot; &#8212; it&#39;s on' }).teaser, 'AT&T "deal" \u2014 it\u2019s on'.replace('\u2019', "'"));
});

test('matches handles accented words as whole words', () => {
  const h = toHit({ ...doc, title: 'Éxito total', teaser: 'la reunión' });
  assert.ok(matches(h, 'éxito')); assert.ok(matches(h, 'reunión'));
  assert.ok(!matches(h, 'xito'), 'must not match inside an accented word');
});

test('toHit marks premium audio and ranks a podcast channel with shows', () => {
  const h = toHit({ ...doc,
    profiles: [{ href: '/v1/profiles/podcast-episode', rels: ['type'] }, { href: '/v1/profiles/has-premium-audio', rels: ['interface'] }],
    collections: [{ href: '/v1/documents/1019', rels: ['topic'] }, { href: '/v1/documents/510318', rels: ['podcast-channel', 'theme'] }] });
  assert.equal(h.premium, true);
  assert.equal(h.collections[0].id, '510318');
  assert.equal(toHit(doc).premium, undefined, 'absent when not premium');
});

test('toHit drops script and style contents, not just their tags', () => {
  const h = toHit({ ...doc, teaser: 'Real <script>alert(1)</script>text <style>p{}</style>here' });
  assert.equal(h.teaser, 'Real text here');
});

// Image and byline shapes trimmed from real documents (g-s921-16132 and an NPR story with a bare image link).
const withImage = {
  ...doc,
  images: [{ href: '#/assets/img2', rels: ['promo-image-wide'] }, { href: '#/assets/img1', rels: ['primary', 'promo-image-wide'] }],
  bylines: [{ href: '#/assets/by1' }],
  assets: {
    ...doc.assets,
    img1: { title: 'Danielle Ponder', caption: 'Ponder on stage.', producer: null, provider: 'Courtesy of the artist',
      enclosures: [
        { rels: ['image-square', 'scalable'], href: 'https://cdn/sq.jpg', hrefTemplate: 'https://cdn/sq/{width}/{quality}/{format}', width: 1000, height: 1000 },
        { rels: ['image-wide', 'scalable'], href: 'https://cdn/wide.jpg', hrefTemplate: 'https://cdn/wide/{width}/{quality}/{format}', width: 2160, height: 1215 },
      ] },
    img2: { title: 'other', enclosures: [{ rels: ['image-wide'], href: 'https://cdn/other.jpg' }] },
    by1: { name: 'Tarik Moody', bylineDocuments: [{ href: '/v1/documents/1192772937', rels: ['biography'] }] },
  },
};

test('toHit carries the primary image: wide crop href, resize template, credit from producer or provider, caption', () => {
  const h = toHit(withImage);
  assert.deepEqual(h.image, { href: 'https://cdn/wide.jpg', template: 'https://cdn/wide/{width}/{quality}/{format}', credit: 'Courtesy of the artist', caption: 'Ponder on stage.' });
});

test('toHit prefers the producer as credit and falls back to the first image when none is primary', () => {
  const producer = { ...withImage, images: [{ href: '#/assets/img1' }], assets: { ...withImage.assets, img1: { ...withImage.assets.img1, producer: 'Jackie Lay/NPR' } } };
  assert.equal(toHit(producer).image?.credit, 'Jackie Lay/NPR');
});

test('toHit has no image field when the document has none', () => {
  assert.equal('image' in toHit(doc), false);
});

test('toHit carries the byline name from the byline asset and the person ids for lookup when the name is missing', () => {
  assert.equal(toHit(withImage).byline, 'Tarik Moody');
  const nameless = { ...withImage, assets: { ...withImage.assets, by1: { name: null, bylineDocuments: [{ href: '/v1/documents/1192772937', rels: ['biography'] }] } } };
  const h = toHit(nameless);
  assert.equal('byline' in h, false);
  assert.deepEqual(h.bylineIds, ['1192772937']);
});
