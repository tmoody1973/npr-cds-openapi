// Tools for the people who publish: "why isn't my story on the site", "what labels does this
// station use", "what changed since this morning". Same deps as find_stories.
import { PREMIUM_NOTE, toHit, type Hit } from './compact';
import type { FindDeps } from './find';
import { NPR_SERVICE_ID } from './cds';

const ORG = 'https://organization.api.npr.org/v4/services/';
const PAGE = 300;
type Station = { id: string; name: string };

async function resolveStation(deps: FindDeps, station?: string): Promise<Station | undefined> {
  const wanted = station ?? deps.homeStation;
  if (!wanted) return undefined;
  const [s] = await deps.catalog.findStation(wanted);
  if (!s) throw new Error(station ? `No station matches "${station}".` : `NPR_CDS_HOME_STATION is "${wanted}" but no station in NPR's directory matches it. Check the id with find_station.`);
  return s;
}

const newestFrom = (station: Station) =>
  new URLSearchParams({ profileIds: 'story', sort: 'publishDateTime:desc', limit: String(PAGE), ownerHrefs: ORG + station.id });

const idFromLink = (href: string) => href.replace(/^.*\//, '');
// Brightspot sometimes emits a collection link to "/v1/documents/null"; it is not a collection.
const isRealLink = (l: any) => l?.href && idFromLink(l.href) !== 'null' && !(l.rels ?? []).includes('byline');
const sameUrl = (a: string, b: string) => {
  const norm = (u: string) => { try { const x = new URL(u); return `${x.host.toLowerCase().replace(/^www\./, '')}${x.pathname.replace(/\/$/, '')}`; } catch { return u; } };
  return norm(a) === norm(b);
};

// ---- check_story ----
export type StoryCheck = {
  found: boolean; searched: string; problems: string[];
  id?: string; title?: string; published?: string; url?: string;
  show?: string; topics?: string[]; tags?: string[]; categories?: string[];
  audio?: Hit['audio']; primaryImage?: boolean; teaser?: boolean;
};

export async function checkStory(args: { id?: string; url?: string; station?: string }, deps: FindDeps): Promise<StoryCheck> {
  let id = args.id;
  if (!id && args.url) id = args.url.match(/^https?:\/\/(?:www\.)?npr\.org\/\d{4}\/\d{2}\/\d{2}\/([^/?#]+)/)?.[1];
  if (!id && !args.url) throw new Error('Give me a CDS id or a story url.');

  let doc: any; let searched: string;
  if (id) {
    searched = `id ${id}`;
    doc = (await deps.cdsQuery(new URLSearchParams({ ids: id, limit: '1' }))).resources?.[0];
  } else {
    const station = await resolveStation(deps, args.station);
    if (!station) throw new Error('A station url needs a station name, or NPR_CDS_HOME_STATION set.');
    const docs = (await deps.cdsQuery(newestFrom(station))).resources ?? [];
    searched = `newest ${docs.length} stories from ${station.name}`;
    doc = docs.find((d: any) => (d.webPages ?? []).some((w: any) => w.href && sameUrl(w.href, args.url!)));
  }
  if (!doc) {
    return { found: false, searched, problems: [`Not in CDS (looked at ${searched}). Is it published? Drafts and scheduled posts never reach CDS. Has it been five minutes since publishing?`] };
  }

  const names = await deps.catalog.learnFromDocs([doc]);
  const name = (l: any) => names.get(idFromLink(l.href))?.title ?? idFromLink(l.href);
  const ofRel = (rel: string) => (doc.collections ?? []).filter((l: any) => isRealLink(l) && (l.rels ?? [])[0] === rel).map(name);
  const hit = toHit(doc);
  const show = ofRel('series')[0] ?? ofRel('program')[0];
  const primaryImage = (doc.images ?? []).length > 0;
  const teaser = Boolean(doc.teaser);
  const problems: string[] = [];
  if (!show) problems.push('No Show set. Grove finds show episodes by the Show label.');
  if (!hit.audio) problems.push('No audio attached in Brightspot. The story will show without a player.');
  if (!primaryImage) problems.push('No primary image. The list thumbnail and header will be blank.');
  if (!teaser) problems.push('No teaser. The line under the title on the list page will be empty.');

  return {
    found: true, searched, problems, id: doc.id, title: doc.title, published: hit.date, url: hit.url,
    show, topics: ofRel('topic'), tags: ofRel('tag'), categories: ofRel('category'),
    audio: hit.audio, primaryImage, teaser,
  };
}

// ---- station_labels ----
type Label = { id: string; name: string; count: number };
const GROUPS: Record<string, string> = { series: 'shows', program: 'programs', topic: 'topics', tag: 'tags', category: 'categories', 'podcast-channel': 'podcasts' };

export async function stationLabels(args: { station?: string }, deps: FindDeps) {
  const station = await resolveStation(deps, args.station);
  if (!station) throw new Error('Give me a station name, or set NPR_CDS_HOME_STATION.');
  const podcastQuery = newestFrom(station); podcastQuery.set('profileIds', 'podcast-episode'); podcastQuery.set('excludedProfileIds', 'newscast');
  const [stories, episodes] = await Promise.all([deps.cdsQuery(newestFrom(station)), deps.cdsQuery(podcastQuery)]);
  const docs: any[] = stories.resources ?? [];
  const podcastDocs: any[] = episodes.resources ?? [];
  const names = await deps.catalog.learnFromDocs([...docs, ...podcastDocs]);
  const counts = new Map<string, { rel: string; count: number }>();
  const tally = (set: any[], only?: string) => {
    for (const d of set) for (const l of (d.collections ?? []).filter(isRealLink)) {
      const rel = (l.rels ?? [])[0] ?? 'collection';
      if (only ? rel !== only : rel === 'podcast-channel') continue;
      const id = idFromLink(l.href);
      counts.set(id, { rel, count: (counts.get(id)?.count ?? 0) + 1 });
    }
  };
  // Story labels come from stories; podcasts from the episode scan. An episode's topic or tag
  // rels are not counted, so topics reflect what the station writes, not what its podcasts are filed under.
  tally(docs); tally(podcastDocs, 'podcast-channel');
  const out: Record<string, Label[]> = { shows: [], podcasts: [], programs: [], topics: [], tags: [], categories: [], other: [] };
  for (const [id, { rel, count }] of counts) out[GROUPS[rel] ?? 'other'].push({ id, name: names.get(id)?.title ?? id, count });
  for (const list of Object.values(out)) list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { station, scanned: docs.length, scannedPodcastEpisodes: podcastDocs.length, ...out };
}

// ---- whats_new_since ----
export async function whatsNewSince(args: { since: string; station?: string; limit?: number }, deps: FindDeps) {
  const station = (await resolveStation(deps, args.station)) ?? { id: NPR_SERVICE_ID, name: 'NPR' };
  const p = new URLSearchParams({
    profileIds: 'story', ownerHrefs: ORG + station.id, limit: String(PAGE),
    editorialLastModifiedDateTime: `${args.since}...`, sort: 'editorialLastModifiedDateTime:desc',
  });
  const docs = ((await deps.cdsQuery(p)).resources ?? [])
    .sort((a: any, b: any) => Date.parse(b.editorialLastModifiedDateTime) - Date.parse(a.editorialLastModifiedDateTime))
    .slice(0, args.limit ?? 20);
  const names = await deps.catalog.learnFromDocs(docs);
  // CDS reads a bare date as US Eastern (-05:00); classify new vs updated on the same boundary.
  const sinceMs = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(args.since) ? `${args.since}T00:00:00-05:00` : args.since);
  const hits = docs.map((d: any) => {
    const h = toHit(d);
    for (const c of h.collections) { const n = names.get(c.id); if (n) c.name = n.title; }
    return { ...h, modified: d.editorialLastModifiedDateTime as string, change: Date.parse(d.publishDateTime) >= sinceMs ? 'new' : 'updated' };
  });
  return { searched: `stories from ${station.name} edited or published since ${args.since}`, hits };
}

// ---- latest_newscast ----
export { PREMIUM_NOTE };

export async function latestNewscast(args: { length?: 'long' | 'short'; station?: string }, deps: FindDeps) {
  const station = args.station ? await resolveStation(deps, args.station) : { id: NPR_SERVICE_ID, name: 'NPR' };
  const p = new URLSearchParams({ profileIds: 'newscast', ownerHrefs: ORG + station!.id, sort: 'publishDateTime:desc', limit: '10' });
  const docs: any[] = (await deps.cdsQuery(p)).resources ?? [];
  const wanted = args.length ?? 'long';
  // NPR ids end in -long or -short; other stations publish one cut.
  const doc = docs.find((d) => d.id.endsWith(`-${wanted}`)) ?? docs[0];
  if (!doc) throw new Error(`No newscast from ${station!.name} in CDS.`);
  const hit = toHit(doc);
  const premium = (doc.profiles ?? []).some((pr: any) => pr.href?.endsWith('/has-premium-audio'));
  return {
    id: doc.id, title: doc.title, station: station!.name, published: doc.publishDateTime,
    seconds: hit.audio?.seconds, audio: hit.audio?.href, expires: doc.expirationDateTime,
    ...(premium ? { rights: PREMIUM_NOTE } : {}),
    ...(hit.audio ? {} : { warning: 'This newscast has no audio asset in CDS; do not present it as playable.' }),
  };
}
