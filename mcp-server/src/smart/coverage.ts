// Composed tools: archive digs by window, coverage across the network, and editorial gaps.
import { findStories, rightsFor, type FindDeps, type FoundHit } from './find';
import { matchesText } from './match';
import { toHit } from './compact';
import { NPR_SERVICE_ID } from './cds';

const ORG = 'https://organization.api.npr.org/v4/services/';
const PAGE = 300;
const HALF_YEAR_DAYS = 183;
const MAX_WINDOWS = 12;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (day: string, days: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return iso(d); };

// ---- search_archive ----
export async function searchArchive(
  args: { query: string; station?: string; kind?: 'stories' | 'podcasts'; from?: string; to?: string; limit?: number; depth?: number },
  deps: FindDeps,
) {
  const station = args.station ?? deps.homeStation;
  if (!station) throw new Error('Give me a station, or set NPR_CDS_HOME_STATION.');
  const to = args.to ?? iso(new Date());
  const from = args.from ?? '2010-01-01';
  const limit = args.limit ?? 20;
  const hits: FoundHit[] = [];
  let end = to, windows = 0, read = 0, oldest = to, note: string | undefined, stationName = station;
  while (end >= from && hits.length < limit) {
    if (windows >= MAX_WINDOWS) { note = `Stopped after ${MAX_WINDOWS} windows; oldest window reached was ${oldest}. Ask again with to="${shift(oldest, -1)}" to keep going.`; break; }
    const start = shift(end, -HALF_YEAR_DAYS) < from ? from : shift(end, -HALF_YEAR_DAYS);
    const r = await findStories({ query: args.query, station, kind: args.kind, since: start, until: end, limit: limit - hits.length, scanPages: args.depth ?? 1 }, deps);
    hits.push(...r.hits); read += r.scanned; windows++; oldest = start;
    const m = r.searched.match(/station ([^(]+) \(/); if (m) stationName = m[1].trim();
    end = shift(start, -1);
  }
  return {
    searched: `keyword "${args.query}" for ${stationName}, ${from} to ${to}: ${windows} half-year windows, ${read} stories read`,
    windowsScanned: windows, storiesRead: read, hits, ...(note ? { note } : {}),
  };
}

// ---- coverage_scan ----
type Group = { station: { id: string; name: string }; hits: FoundHit[] };

export async function coverageScan(
  args: { topic: string; since: string; until?: string; stations?: string[]; limit?: number },
  deps: FindDeps,
) {
  const limit = args.limit ?? 10;
  const groups: Group[] = [];
  const searched: string[] = [];
  if (args.stations?.length) {
    for (const name of args.stations) {
      const r = await findStories({ query: args.topic, station: name, since: args.since, until: args.until, limit }, deps);
      const m = r.searched.match(/station ([^(]+) \((s\d+)\)/);
      groups.push({ station: { id: m?.[2] ?? name, name: m?.[1]?.trim() ?? name }, hits: r.hits });
    }
    searched.push(`"${args.topic}" since ${args.since} at ${args.stations.join(', ')}`);
  } else {
    const npr = await findStories({ query: args.topic, since: args.since, until: args.until, limit }, deps);
    groups.push({ station: { id: NPR_SERVICE_ID, name: 'NPR' }, hits: npr.hits });
    // The network: the newest stories from every station in the window, matched by words here.
    const p = new URLSearchParams({ profileIds: 'story', sort: 'publishDateTime:desc', limit: String(PAGE), publishDateTime: `${args.since}...${args.until ?? ''}` });
    const docs: any[] = (await deps.cdsQuery(p)).resources ?? [];
    const names = new Map((await deps.catalog.stations?.() ?? []).map((s) => [s.id, s.name]));
    const byOwner = new Map<string, FoundHit[]>();
    for (const d of docs) {
      const h: FoundHit = toHit(d);
      if (h.owner === NPR_SERVICE_ID || !matchesText(`${h.title} ${h.teaser ?? ''}`, args.topic)) continue;
      const rights = rightsFor(h, deps.homeStation); if (rights) h.rights = rights;
      byOwner.set(h.owner, [...(byOwner.get(h.owner) ?? []), h]);
    }
    for (const [id, hits] of byOwner) groups.push({ station: { id, name: names.get(id) ?? id }, hits: hits.slice(0, limit) });
    searched.push(`"${args.topic}" since ${args.since}: NPR's newest stories (${npr.scanned} read) and the network's newest ${docs.length}`);
  }
  groups.sort((a, b) => b.hits.length - a.hits.length || a.station.name.localeCompare(b.station.name));
  return { searched: searched.join('; '), byStation: groups };
}

// ---- coverage_gap ----
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'it', 'its', 'this', 'that', 'these', 'those', 'what', 'how', 'why', 'who', 'when', 'where', 'across', 'after', 'before', 'over', 'under', 'into', 'about', 'says', 'said', 'new', 'more', 'than', 'will', 'has', 'have', 'had', 'not', 'but', 'they', 'their', 'your', 'our', 'his', 'her']);
const words = (t: string) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w)));

// Count of meaningful words two titles share. Two or more is "probably the same story".
export function titleOverlap(a: string, b: string): number {
  const wb = words(b); let n = 0;
  for (const w of words(a)) if (wb.has(w)) n++;
  return n;
}

export async function coverageGap(args: { topic: string; since: string; until?: string; limit?: number }, deps: FindDeps) {
  if (!deps.homeStation) throw new Error('coverage_gap needs a home station. Run `npx -y npr-cds-mcp station` or set NPR_CDS_HOME_STATION.');
  const [npr, ours] = await Promise.all([
    findStories({ query: args.topic, since: args.since, until: args.until, limit: args.limit ?? 20 }, deps),
    findStories({ query: args.topic, station: deps.homeStation, since: args.since, until: args.until, limit: 50 }, deps),
  ]);
  const flagged = npr.hits.map((h) => {
    const match = ours.hits.find((o) => titleOverlap(h.title, o.title) >= 2);
    return match
      ? { ...h, localized: { id: match.id, title: match.title, url: match.url } }
      : { ...h, gap: 'not localized: no story of ours shares two or more meaningful title words. Judge by reading; this is a hint.' };
  });
  return {
    searched: `"${args.topic}" since ${args.since}: NPR (${npr.scanned} read) against ours (${ours.searched})`,
    npr: flagged, ours: ours.hits,
    summary: `${flagged.filter((f) => 'gap' in f).length} of ${flagged.length} NPR stories have no obvious local version.`,
  };
}
