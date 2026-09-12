import { toHit, type Hit } from './compact';
import { matches, matchesText } from './match';
import type { Collection, Station } from './catalog';
import { NPR_SERVICE_ID } from './cds';

export type FindArgs = {
  query?: string; station?: string; show?: string; collection?: string;
  since?: string; until?: string; limit?: number; scanPages?: number;
};
export type FindDeps = {
  cdsQuery: (params: URLSearchParams) => Promise<{ resources: any[] }>;
  catalog: {
    findStation: (q: string) => Promise<Station[]>;
    findCollection: (q: string) => Promise<Collection[]>;
    learnFromDocs: (docs: any[]) => Promise<Map<string, Collection>>;
  };
  homeStation?: string; // service id whose content we may store; everything else is display-only
};
export type FoundHit = Hit & { rights?: string };

const ORG = 'https://organization.api.npr.org/v4/services/';
const PAGE = 300;
export const DISPLAY_ONLY = 'display-only: attribute via url, refresh regularly, do not store beyond display';

export async function findStories(args: FindArgs, deps: FindDeps): Promise<{ searched: string; hits: FoundHit[] }> {
  const { query, station, show, collection, since, until } = args;
  if (!query && !station && !show && !collection) throw new Error('Give me at least one of: query, station, show, collection.');
  const limit = args.limit ?? 10;
  const scanPages = Math.min(args.scanPages ?? 1, 6);
  const searched: string[] = [];

  const base = new URLSearchParams({ profileIds: 'story', sort: 'publishDateTime:desc', limit: String(PAGE) });
  if (since || until) { base.set('publishDateTime', `${since ?? ''}...${until ?? ''}`); searched.push(`published ${since ?? 'any'} to ${until ?? 'now'}`); }
  if (station) {
    const [s] = await deps.catalog.findStation(station);
    if (!s) throw new Error(`No station matches "${station}".`);
    base.set('ownerHrefs', ORG + s.id); searched.push(`station ${s.name} (${s.id})`);
  }

  const collections: Collection[] = [];
  for (const name of [show, collection].filter(Boolean) as string[]) {
    let [c] = await deps.catalog.findCollection(name);
    if (!c) {
      // Station shows are not fetchable documents; learn them from the station's newest stories.
      const owner = base.get('ownerHrefs') ?? (deps.homeStation ? ORG + deps.homeStation : undefined);
      if (owner) {
        const p = new URLSearchParams(base); p.set('ownerHrefs', owner);
        await deps.catalog.learnFromDocs((await deps.cdsQuery(p)).resources ?? []);
        [c] = await deps.catalog.findCollection(name);
      }
    }
    if (!c) throw new Error(`No show or collection matches "${name}". Try find_collection, or give a station so I can learn its shows.`);
    collections.push(c);
  }
  // Fuzzy name matches widen a keyword query, but only when the query words really are in the title.
  if (query) collections.push(...(await deps.catalog.findCollection(query)).filter((c) => matchesText(c.title, query)).slice(0, 3));
  if (collections.length) searched.push(`collections ${collections.map((c) => `"${c.title}" (${c.id})`).join(', ')}`);

  const scanKeyword = async (): Promise<any[]> => {
    if (!query) return [];
    const found: any[] = [];
    let scanned = 0;
    // All of CDS at 300 per page is only hours of network output; scope the scan to NPR unless a station was named.
    const scope = new URLSearchParams(base);
    if (!scope.has('ownerHrefs')) scope.set('ownerHrefs', ORG + NPR_SERVICE_ID);
    for (let page = 0; page < scanPages; page++) {
      const p = new URLSearchParams(scope); p.set('offset', String(page * PAGE));
      const { resources = [] } = await deps.cdsQuery(p);
      scanned += resources.length;
      found.push(...resources.filter((d) => matches(toHit(d), query)));
      if (resources.length < PAGE) break;
    }
    searched.push(`keyword "${query}" over ${scanned} newest ${station ? '' : 'NPR '}stories`);
    return found;
  };
  const fetchByCollection = async (): Promise<any[]> => {
    if (!collections.length) return [];
    const p = new URLSearchParams(base); p.set('collectionIds', collections.map((c) => c.id).join(','));
    return (await deps.cdsQuery(p)).resources ?? [];
  };
  const [keyword, byCollection] = await Promise.all([scanKeyword(), fetchByCollection()]);
  const plain = !query && !collections.length ? (await deps.cdsQuery(base)).resources ?? [] : [];
  if (plain.length) searched.push('newest stories');

  const seen = new Map<string, any>();
  for (const d of [...keyword, ...byCollection, ...plain]) if (!seen.has(d.id)) seen.set(d.id, d);
  const docs = [...seen.values()].sort((a, b) => Date.parse(b.publishDateTime) - Date.parse(a.publishDateTime)).slice(0, limit);

  const hits: FoundHit[] = docs.map(toHit);
  const names = await deps.catalog.learnFromDocs(docs);
  for (const h of hits) {
    for (const c of h.collections) { const n = names.get(c.id); if (n) c.name = n.title; }
    if (deps.homeStation && h.owner !== deps.homeStation) h.rights = DISPLAY_ONLY;
  }
  return { searched: searched.join('; '), hits };
}
