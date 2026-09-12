// Compact "hit": the dozen bytes a person needs from a 17 KB CDS story document.
// A full document is one getDocument call away, so nothing here needs to be complete.

export type Hit = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD of publishDateTime
  owner: string; // organization service id, e.g. s921
  teaser?: string;
  url?: string; // canonical web page
  audio?: { seconds: number; href: string };
  collections: Array<{ id: string; rel: string; name?: string }>;
};

type Link = { href?: string; rels?: string[] };
type Doc = Record<string, any>;

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
// NPR stories carry 8-12 collections; a person needs the show, the program, then a few topics.
const REL_ORDER = ['series', 'program', 'topic', 'category', 'tag'];
const MAX_COLLECTIONS = 5;
const relRank = (rel: string) => { const i = REL_ORDER.indexOf(rel); return i === -1 ? REL_ORDER.length : i; };
const lastSegment = (href: string) => href.replace(/^.*\//, '');

export function toHit(doc: Doc): Hit {
  const links: Link[] = doc.collections ?? [];
  const collections = links
    .filter((l) => l.href && !(l.rels ?? []).includes('byline'))
    .map((l) => ({ id: lastSegment(l.href!), rel: (l.rels ?? [])[0] ?? 'collection' }))
    .sort((a, b) => relRank(a.rel) - relRank(b.rel))
    .slice(0, MAX_COLLECTIONS);

  const audioLinks: Link[] = doc.audio ?? [];
  const audioLink = audioLinks.find((a) => (a.rels ?? []).includes('primary')) ?? audioLinks[0];
  const audioKey = audioLink?.href?.replace('#/assets/', '');
  const audioAsset = audioKey ? doc.assets?.[audioKey] : undefined;
  const audioHref = audioAsset?.enclosures?.find((e: Link & { type?: string }) => e.type === 'audio/mpeg')?.href
    ?? audioAsset?.enclosures?.[0]?.href;

  const canonical = (doc.webPages as Link[] | undefined)?.find((w) => (w.rels ?? []).includes('canonical'))?.href
    ?? doc.webPages?.[0]?.href;

  return {
    id: doc.id,
    title: doc.title,
    date: String(doc.publishDateTime ?? '').slice(0, 10),
    owner: lastSegment(doc.owners?.[0]?.href ?? ''),
    ...(doc.teaser ? { teaser: stripHtml(doc.teaser) } : {}),
    ...(canonical ? { url: canonical } : {}),
    ...(audioHref ? { audio: { seconds: Number(audioAsset.duration ?? 0), href: audioHref } } : {}),
    collections,
  };
}
