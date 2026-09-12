// Tools for the people who publish: "why isn't my story on the site", "what labels does this
// station use", "what changed since this morning". Same deps as find_stories.
import { toHit, type Hit } from './compact';
import type { FindDeps } from './find';
import { NPR_SERVICE_ID } from './cds';

const ORG = 'https://organization.api.npr.org/v4/services/';
const PAGE = 300;
type Station = { id: string; name: string };

async function resolveStation(deps: FindDeps, station?: string): Promise<Station | undefined> {
  const wanted = station ?? deps.homeStation;
  if (!wanted) return undefined;
  const [s] = await deps.catalog.findStation(wanted);
  if (station && !s) throw new Error(`No station matches "${station}".`);
  return s ?? { id: wanted, name: wanted };
}

const newestFrom = (station: Station) =>
  new URLSearchParams({ profileIds: 'story', sort: 'publishDateTime:desc', limit: String(PAGE), ownerHrefs: ORG + station.id });

const idFromLink = (href: string) => href.replace(/^.*\//, '');
// Brightspot sometimes emits a collection link to "/v1/documents/null"; it is not a collection.
const isRealLink = (l: any) => l?.href && idFromLink(l.href) !== 'null' && (l.rels ?? [])[0] !== 'byline';
const sameUrl = (a: string, b: string) => {
  const norm = (u: string) => { try { const x = new URL(u); return `${x.host}${x.pathname.replace(/\/$/, '')}`; } catch { return u; } };
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
  if (!id && args.url) id = args.url.match(/npr\.org\/\d{4}\/\d{2}\/\d{2}\/([^/?#]+)/)?.[1];
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
  const show = ofRel('series')[0];
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
const GROUPS: Record<string, string> = { series: 'shows', program: 'programs', topic: 'topics', tag: 'tags', category: 'categories' };

export async function stationLabels(args: { station?: string }, deps: FindDeps) {
  const station = await resolveStation(deps, args.station);
  if (!station) throw new Error('Give me a station name, or set NPR_CDS_HOME_STATION.');
  const docs = (await deps.cdsQuery(newestFrom(station))).resources ?? [];
  const names = await deps.catalog.learnFromDocs(docs);
  const counts = new Map<string, { rel: string; count: number }>();
  for (const d of docs) for (const l of (d.collections ?? []).filter(isRealLink)) {
    const rel = (l.rels ?? [])[0] ?? 'collection';
    const id = idFromLink(l.href);
    counts.set(id, { rel, count: (counts.get(id)?.count ?? 0) + 1 });
  }
  const out: Record<string, Label[]> = { shows: [], programs: [], topics: [], tags: [], categories: [], other: [] };
  for (const [id, { rel, count }] of counts) out[GROUPS[rel] ?? 'other'].push({ id, name: names.get(id)?.title ?? id, count });
  for (const list of Object.values(out)) list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { station, scanned: docs.length, ...out };
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
  const sinceMs = Date.parse(args.since);
  const hits = docs.map((d: any) => {
    const h = toHit(d);
    for (const c of h.collections) { const n = names.get(c.id); if (n) c.name = n.title; }
    return { ...h, modified: d.editorialLastModifiedDateTime as string, change: Date.parse(d.publishDateTime) >= sinceMs ? 'new' : 'updated' };
  });
  return { searched: `stories from ${station.name} edited or published since ${args.since}`, hits };
}
