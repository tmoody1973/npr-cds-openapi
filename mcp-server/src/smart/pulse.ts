// The network's week in counts: which stations published, which shows and podcasts had episodes,
// which topics ran, from one paged scan of the newest documents across every owner. Ids, names,
// counts, and dates only: no teaser, body, or url ever leaves this module. The showroom's desk
// rebuilds its Explore index from this once an hour.
import type { FindDeps } from './find';
import type { Station } from './catalog';

const PAGE = 300;
const SHOW_RELS = new Set(['series', 'program', 'podcast-channel']);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return iso(d); };
const lastSegment = (href: string) => href.replace(/^.*\//, '');

export type PulseArgs = { since?: string; until?: string; depth?: number; limit?: number };
export type PulseRow = { id: string; name: string; count: number; last: string };
export type PulseStation = PulseRow & { state?: string; city?: string };
export type PulseShow = PulseRow & { rel: 'series' | 'program' | 'podcast-channel'; owner: string };
export type Pulse = {
  searched: string; since: string; until?: string;
  scanned: { stories: number; episodes: number }; capped: boolean;
  stations: PulseStation[]; shows: PulseShow[]; topics: PulseRow[];
};

type Tally = Map<string, { count: number; last: string; rel?: string; owner?: string }>;
function bump(t: Tally, id: string, date: string, extra: { rel?: string; owner?: string } = {}) {
  const cur = t.get(id);
  t.set(id, { count: (cur?.count ?? 0) + 1, last: cur && cur.last > date ? cur.last : date, rel: cur?.rel ?? extra.rel, owner: cur?.owner ?? extra.owner });
}
const byCountThenName = <T extends PulseRow>(a: T, b: T) => b.count - a.count || b.last.localeCompare(a.last) || a.name.localeCompare(b.name);

async function scan(deps: FindDeps, profile: 'story' | 'podcast-episode', pages: number, since: string, until?: string) {
  const docs: any[] = [];
  for (let page = 0; page < pages; page++) {
    const p = new URLSearchParams({ profileIds: profile, sort: 'publishDateTime:desc', limit: String(PAGE), offset: String(page * PAGE), publishDateTime: `${since}...${until ?? ''}` });
    if (profile === 'podcast-episode') p.set('excludedProfileIds', 'newscast');
    const batch: any[] = (await deps.cdsQuery(p)).resources ?? [];
    docs.push(...batch);
    if (batch.length < PAGE) return { docs, capped: false };
  }
  return { docs, capped: true };
}

function tallyCollections(doc: any, date: string, owner: string, shows: Tally, topics: Tally) {
  for (const l of doc.collections ?? []) {
    const rel: string = (l.rels ?? [])[0] ?? 'collection';
    const id = l.href ? lastSegment(l.href) : '';
    if (!id || id === 'null' || rel === 'byline') continue;
    if (SHOW_RELS.has(rel)) bump(shows, id, date, { rel, owner });
    else if (rel === 'topic') bump(topics, id, date);
  }
}

export async function networkPulse(args: PulseArgs, deps: FindDeps): Promise<Pulse> {
  const since = args.since ?? daysAgo(7);
  const until = args.until;
  const depth = Math.min(Math.max(args.depth ?? 4, 1), 6);
  const limit = args.limit ?? 60;
  // Podcast episodes are one page: they count toward shows, never toward a station's story count.
  const [stories, episodes] = await Promise.all([scan(deps, 'story', depth, since, until), scan(deps, 'podcast-episode', 1, since, until)]);

  const stations: Tally = new Map(), shows: Tally = new Map(), topics: Tally = new Map();
  for (const d of stories.docs) {
    const owner = lastSegment(d.owners?.[0]?.href ?? ''), date = String(d.publishDateTime ?? '').slice(0, 10);
    if (!owner || !date) continue;
    bump(stations, owner, date);
    tallyCollections(d, date, owner, shows, topics);
  }
  for (const d of episodes.docs) {
    const owner = lastSegment(d.owners?.[0]?.href ?? ''), date = String(d.publishDateTime ?? '').slice(0, 10);
    if (owner && date) tallyCollections(d, date, owner, shows, topics);
  }

  const names = await deps.catalog.learnFromDocs([...stories.docs, ...episodes.docs]);
  const directory = new Map((await deps.catalog.stations?.() ?? []).map((s) => [s.id, s]));
  // City and state come from NPR's station finder, one lookup per station, cached by the catalog after the first pulse.
  const stationRows: PulseStation[] = [];
  for (const [id, t] of stations) {
    const base: Station = directory.get(id) ?? { id, name: id };
    let s = base;
    if (deps.catalog.enrichStation) { try { s = await deps.catalog.enrichStation(id); } catch { /* finder down: name only */ } }
    stationRows.push({ id, name: base.name, count: t.count, last: t.last, ...(s.state ? { state: s.state } : {}), ...(s.city ? { city: s.city } : {}) });
  }
  const showRows: PulseShow[] = [...shows].map(([id, t]) => ({ id, name: names.get(id)?.title ?? id, rel: t.rel as PulseShow['rel'], owner: t.owner ?? '', count: t.count, last: t.last }));
  const topicRows: PulseRow[] = [...topics].map(([id, t]) => ({ id, name: names.get(id)?.title ?? id, count: t.count, last: t.last }));

  const capped = stories.capped;
  return {
    searched: `network stories since ${since}${until ? ` to ${until}` : ''}: ${stories.docs.length} newest stories${capped ? ' (the window holds more than that; raise depth)' : ''} and ${episodes.docs.length} newest podcast episodes, counted by station, show, and topic`,
    since, ...(until ? { until } : {}),
    scanned: { stories: stories.docs.length, episodes: episodes.docs.length }, capped,
    stations: stationRows.sort(byCountThenName),
    shows: showRows.sort(byCountThenName).slice(0, limit),
    topics: topicRows.sort(byCountThenName).slice(0, limit),
  };
}
