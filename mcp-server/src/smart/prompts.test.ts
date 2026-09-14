import { test } from 'node:test';
import assert from 'node:assert/strict';
import { morningPrep, newsletterDraft, weeklyPrep, showPrep } from './prompts';

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

test('newsletter-draft names the home station in step 1 when no station is given, so NPR is never mistaken for ours', () => {
  const t = newsletterDraft({ topic: 'music' }, 's921');
  const step1 = t.split('\n').find((l) => l.startsWith('1.'))!;
  assert.match(step1, /station="s921"/);
  assert.doesNotMatch(step1, /station="NPR"/);
  assert.match(newsletterDraft({ topic: 'music', station: 'KCRW' }, 's921'), /station="KCRW"/);
});

test('weekly-prep defaults to seven days back and calls our week, the gap, then NPR ahead, in order', () => {
  const t = weeklyPrep({}, 's921');
  assert.match(t, /since="\d{4}-\d{2}-\d{2}"/);
  const order = ['whats_new_since', 'coverage_gap', 'find_stories'].map((n) => t.indexOf(n));
  assert.ok(order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2], 'tools appear in call order');
  assert.match(t, /station="s921"/); assert.match(t, /station="NPR"/);
  assert.match(t, /week ahead/i); assert.match(t, /canonical/i); assert.match(t, /never invent/i);
});

test('show-prep needs a show and calls its episodes, then the network on its beat, with links', () => {
  const t = showPrep({ show: 'Ladies First' }, 's921');
  assert.match(t, /show="Ladies First"/);
  const order = ['find_stories', 'coverage_scan'].map((n) => t.indexOf(n));
  assert.ok(order[0] >= 0 && order[0] < order[1], 'episodes before the network scan');
  assert.match(t, /canonical/i); assert.match(t, /audio link/i);
  assert.throws(() => showPrep({} as any, 's921'), /show/i);
});

const PREP_RULE_PATTERNS = [
  /Do not mention tools, tool names, or how the tools compare stations\./,
  /Do not add a rights paragraph; the page shows rights notes separately\./,
  /Never suggest a local angle, talk break, or host question built on a death, crime, abuse, or disaster\. Such a story may still be listed\./,
];

test('every prep keeps tool talk and rights paragraphs off the page and never builds on a tragedy', () => {
  for (const t of [morningPrep({}), weeklyPrep({}, 's921'), showPrep({ show: 'Ladies First' }, 's921')]) {
    for (const r of PREP_RULE_PATTERNS) assert.match(t, r);
  }
});

test('weekly-prep lists only new stories, collapses updated ones into a count, and picks short subjects, not show names', () => {
  const t = weeklyPrep({}, 's921');
  assert.match(t, /only the stories marked new/i);
  assert.match(t, /older stories were updated; nothing new in them/i);
  assert.match(t, /two subjects that come up most in their titles and teasers: an artist, a genre, a place, or an event, in one to three words/i);
  assert.match(t, /Do not use show or series names\./);
  assert.match(t, /returned no NPR stories, say so in one line/i);
});

test('show-prep scans one subject, tries the genre once, then stops', () => {
  const t = showPrep({ show: 'Ladies First' }, 's921');
  assert.match(t, /single guest or subject/i);
  assert.match(t, /coverage_scan once more with the show's genre or its collection name/i);
  assert.match(t, /then stop searching/i);
  assert.ok((t.match(/Call coverage_scan/g) ?? []).length === 1, 'exactly one instruction to start a scan');
});

test('show-prep for an NPR show reads NPR episodes in step 1', () => {
  const t = showPrep({ show: 'Fresh Air', station: 'NPR' }, 's921');
  const step1 = t.split('\n').find((l) => l.startsWith('1.'))!;
  assert.match(step1, /show="Fresh Air", station="NPR"/);
});
