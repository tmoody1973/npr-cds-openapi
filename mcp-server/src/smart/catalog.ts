import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import MiniSearch from 'minisearch';
import { CDS, NPR_SERVICE_ID } from './cds';

export type Station = { id: string; name: string; call?: string; city?: string };
export type Collection = { id: string; title: string; type: string };
export type FetchJson = (url: string, opts?: { auth?: boolean }) => Promise<any>;

type StationState = { fetchedAt: number; items: Station[] };
type CollectionState = { seededAt?: number; items: Record<string, Collection> };

const DAY = 24 * 60 * 60 * 1000;
const NPR = `https://organization.api.npr.org/v4/services/${NPR_SERVICE_ID}`;
const typeOf = (doc: any): string =>
  (doc.profiles ?? []).find((p: any) => (p.rels ?? []).includes('type'))?.href?.replace(/^.*\//, '') ?? 'collection';
const search = { prefix: true, fuzzy: 0.2 };

// Name-to-id lookups CDS does not offer. Stations come from NPR's public directory,
// collections are learned from whatever ids pass through, seeded with NPR's topics and programs.
// State lives in memory and is mirrored to two JSON files in the cache dir.
// ponytail: no TTL on collections; add one if names start drifting.
export class Catalog {
  private stationState?: StationState;
  private collectionState?: CollectionState;
  private stationIndex?: MiniSearch<Station>;
  private collectionIndex?: MiniSearch<Collection>;

  constructor(private fetchJson: FetchJson, private cacheDir: string) {
    mkdirSync(cacheDir, { recursive: true });
  }

  private load<T>(name: string, fallback: T): T {
    try { return JSON.parse(readFileSync(path.join(this.cacheDir, name), 'utf8')) as T; } catch { return fallback; }
  }
  // Write to a temp file then rename, so a second server process never reads a half-written file.
  private save(name: string, data: unknown) {
    const file = path.join(this.cacheDir, name);
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, file);
  }

  private async stationDirectory(): Promise<StationState> {
    this.stationState ??= this.load<StationState>('stations.json', { fetchedAt: 0, items: [] });
    if (Date.now() - this.stationState.fetchedAt >= DAY || !this.stationState.items.length) {
      const raw: Array<{ id: string; name: string }> = await this.fetchJson('https://organization.api.npr.org/v4/services');
      this.stationState = { fetchedAt: Date.now(), items: raw.map(({ id, name }) => ({ id, name })) };
      this.save('stations.json', this.stationState);
      this.stationIndex = undefined;
    }
    return this.stationState;
  }

  async stations(): Promise<Station[]> { return (await this.stationDirectory()).items; }

  async findStation(query: string): Promise<Station[]> {
    const { items } = await this.stationDirectory();
    if (!this.stationIndex) {
      this.stationIndex = new MiniSearch<Station>({ fields: ['name', 'id'], storeFields: ['id', 'name'], searchOptions: search });
      this.stationIndex.addAll(items);
    }
    const hits = this.stationIndex.search(query).slice(0, 5).map((r) => ({ id: r.id, name: r.name }));
    if (hits.length) return hits;
    // City or market names live only in the station finder.
    const finder = await this.fetchJson(`https://station.api.npr.org/v3/stations?q=${encodeURIComponent(query)}`);
    return (finder.items ?? []).slice(0, 5).map((s: any) => {
      const a = s.attributes ?? {};
      return { id: a.serviceId, name: a.brand?.name ?? a.network?.name ?? a.serviceId, call: a.brand?.call, city: a.brand?.marketCity };
    });
  }

  private collections(): CollectionState {
    return (this.collectionState ??= this.load<CollectionState>('collections.json', { items: {} }));
  }
  private remember(state: CollectionState, docs: any[]) {
    for (const doc of docs) state.items[doc.id] = { id: doc.id, title: doc.title ?? doc.id, type: typeOf(doc) };
  }
  // Merge what another server process may have learned since we loaded, so neither overwrites the other.
  // ponytail: last-writer-wins on the same id; a lock file would close the remaining race.
  private commit(state: CollectionState) {
    const disk = this.load<CollectionState>('collections.json', { items: {} });
    state.items = { ...disk.items, ...state.items };
    state.seededAt ??= disk.seededAt;
    this.save('collections.json', state);
    this.collectionIndex = undefined;
  }

  async resolveCollections(ids: string[]): Promise<Map<string, Collection>> {
    const state = this.collections();
    const missing = [...new Set(ids)].filter((id) => !state.items[id]);
    for (let i = 0; i < missing.length; i += 50) {
      const batch = missing.slice(i, i + 50);
      const params = new URLSearchParams({ ids: batch.join(','), limit: String(batch.length) });
      const { resources = [] } = await this.fetchJson(`${CDS}/v1/documents?${params}`, { auth: true });
      this.remember(state, resources);
    }
    if (missing.length) this.commit(state);
    return new Map(ids.filter((id) => state.items[id]).map((id) => [id, state.items[id]]));
  }

  // Learn collection names from stories that pass through. Station shows are the one kind of
  // collection CDS never serves as a document (their series ids 404), so a series id that did not
  // resolve gets its name from the story url's /show/<slug>/ instead.
  async learnFromDocs(docs: any[]): Promise<Map<string, Collection>> {
    const seen = new Map<string, { rel: string; slug?: string }>();
    for (const d of docs) {
      const url: string = (d.webPages ?? []).find((w: any) => (w.rels ?? []).includes('canonical'))?.href ?? d.webPages?.[0]?.href ?? '';
      const slug = url.match(/\/shows?\/([^/?#]+)/)?.[1];
      for (const l of d.collections ?? []) {
        const rel = (l.rels ?? [])[0] ?? 'collection';
        if (rel === 'byline' || !l.href) continue;
        const id = l.href.replace(/^.*\//, '');
        if (!id || id === 'null') continue;
        const previous = seen.get(id);
        if (!previous || (!previous.slug && slug)) seen.set(id, { rel, slug });
      }
    }
    const known = await this.resolveCollections([...seen.keys()]);
    const state = this.collections();
    let inferred = 0;
    for (const [id, { rel, slug }] of seen) {
      if (known.has(id) || !slug || rel !== 'series') continue;
      state.items[id] = { id, title: slug.split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' '), type: 'series' };
      known.set(id, state.items[id]); inferred++;
    }
    if (inferred) this.commit(state);
    return known;
  }

  private async seed(): Promise<CollectionState> {
    const state = this.collections();
    if (state.seededAt) return state;
    for (const profile of ['topic', 'program', 'podcast-channel']) {
      const { resources = [] } = await this.fetchJson(`${CDS}/v1/documents?ownerHrefs=${NPR}&profileIds=${profile}&limit=300`, { auth: true });
      this.remember(state, resources);
    }
    state.seededAt = Date.now();
    this.commit(state);
    return state;
  }

  async findCollection(query: string): Promise<Collection[]> {
    const { items } = await this.seed();
    if (!this.collectionIndex) {
      this.collectionIndex = new MiniSearch<Collection>({ fields: ['title'], storeFields: ['id', 'title', 'type'], searchOptions: search });
      this.collectionIndex.addAll(Object.values(items));
    }
    return this.collectionIndex.search(query).slice(0, 5).map((r) => ({ id: r.id, title: r.title, type: r.type }));
  }
}
