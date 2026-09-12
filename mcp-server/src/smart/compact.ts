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
  premium?: true; // carries has-premium-audio: play or link, never store
  collections: Array<{ id: string; rel: string; name?: string }>;
};

export const PREMIUM_NOTE = 'premium audio: play or link to it, never store or download it';

type Link = { href?: string; rels?: string[] };
type Doc = Record<string, any>;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
// ponytail: the handful of entities NPR teasers actually use, plus numeric ones; swap in a decoder lib if more appear.
const decodeEntities = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(parseInt(e[1].toLowerCase() === 'x' ? e.slice(2) : e.slice(1), e[1].toLowerCase() === 'x' ? 16 : 10)) : ENTITIES[e.toLowerCase()] ?? m);
export const stripHtml = (s: string) =>
  decodeEntities(s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
// NPR stories carry 8-12 collections; a person needs the show, the program, then a few topics.
const REL_ORDER = ['series', 'podcast-channel', 'program', 'topic', 'category', 'tag'];
const MAX_COLLECTIONS = 5;
const relRank = (rel: string) => { const i = REL_ORDER.indexOf(rel); return i === -1 ? REL_ORDER.length : i; };
const lastSegment = (href: string) => href.replace(/^.*\//, '');

export function toHit(doc: Doc): Hit {
  const links: Link[] = doc.collections ?? [];
  const collections = links
    .filter((l) => l.href && !(l.rels ?? []).includes('byline') && lastSegment(l.href) !== 'null')
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

  const premium = (doc.profiles ?? []).some((p: Link) => p.href?.endsWith('/has-premium-audio'));

  return {
    id: doc.id,
    title: doc.title,
    date: String(doc.publishDateTime ?? '').slice(0, 10),
    owner: lastSegment(doc.owners?.[0]?.href ?? ''),
    ...(doc.teaser ? { teaser: stripHtml(doc.teaser) } : {}),
    ...(canonical ? { url: canonical } : {}),
    ...(audioHref ? { audio: { seconds: Number(audioAsset.duration ?? 0), href: audioHref } } : {}),
    ...(premium ? { premium: true as const } : {}),
    collections,
  };
}
