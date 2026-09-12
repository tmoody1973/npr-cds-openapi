// read_story: the text of one story in reading order, or its transcript, or an honest "not in CDS".
import { stripHtml, toHit, type Hit } from './compact';
import { rightsFor, type FindDeps } from './find';
import { resolveDoc } from './producer';

export type ReaderDeps = FindDeps & { cdsGet: (id: string) => Promise<{ resources: any[] }> };
export type StoryText = {
  id: string; title: string; date: string; url?: string; audio?: Hit['audio']; rights?: string;
  source: 'body' | 'transcript' | 'none'; paragraphs: string[]; words: number; note?: string; searched: string;
};

const DEFAULT_MAX_CHARS = 12_000;
const typeOf = (asset: any) => (asset?.profiles ?? []).find((p: any) => (p.rels ?? []).includes('type'))?.href?.replace(/^.*\//, '');
const countWords = (ps: string[]) => ps.join(' ').split(/\s+/).filter(Boolean).length;

function bodyParagraphs(doc: any): string[] {
  const out: string[] = [];
  for (const l of doc.layout ?? []) {
    const asset = doc.assets?.[String(l.href ?? '').replace('#/assets/', '')];
    const type = typeOf(asset);
    if (type === 'text' && asset.text) { const t = stripHtml(asset.text); if (t) out.push(t); }
    else if (type === 'pull-quote' && asset.quote) out.push(`\u201c${stripHtml(asset.quote)}\u201d`);
  }
  return out;
}

async function transcriptParagraphs(doc: any, deps: ReaderDeps): Promise<string[]> {
  const link = (doc.meta?.extensionLinks ?? []).map((l: any) => String(l.href ?? '')).find((h: string) => h.endsWith('-transcript'));
  if (!link) return [];
  const tr = (await deps.cdsGet(link.replace(/^.*\//, ''))).resources?.[0];
  if (!tr?.text) return [];
  return String(tr.text).split(/<\/p>|\n{2,}/).map((p: string) => stripHtml(p)).filter(Boolean);
}

export async function readStory(args: { id?: string; url?: string; station?: string; maxChars?: number }, deps: ReaderDeps): Promise<StoryText> {
  const { doc, searched } = await resolveDoc(args, deps);
  if (!doc) throw new Error(`Not in CDS (looked at ${searched}).`);
  const hit = toHit(doc);
  let paragraphs = bodyParagraphs(doc);
  let source: StoryText['source'] = paragraphs.length ? 'body' : 'none';
  if (!paragraphs.length) { paragraphs = await transcriptParagraphs(doc, deps); if (paragraphs.length) source = 'transcript'; }

  const words = countWords(paragraphs);
  const max = args.maxChars ?? DEFAULT_MAX_CHARS;
  let note: string | undefined;
  if (source === 'none') note = `CDS holds only the teaser and audio for this story, no text and no transcript yet. The web page may have more: ${hit.url ?? 'no url'}.`;
  const kept: string[] = []; let size = 0;
  for (const p of paragraphs) { if (size + p.length > max) break; kept.push(p); size += p.length + 1; }
  if (kept.length < paragraphs.length) note = `Truncated to ${countWords(kept)} of ${words} words (maxChars ${max}). Raise maxChars for the rest.`;

  return {
    id: doc.id, title: doc.title, date: hit.date, url: hit.url, audio: hit.audio, rights: rightsFor(hit, deps.homeStation),
    source, paragraphs: kept, words, ...(note ? { note } : {}), searched,
  };
}
