import type { Hit } from './compact';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Every query term must appear in the text, case-insensitive. Terms under four letters must be
// whole words ("AI" is not "Airport"); longer terms may be prefixes ("anthrop" finds Anthropic).
// ponytail: no stemming or synonyms; add MiniSearch over hits if recall is short.
export function matchesText(text: string, query: string): boolean {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  return terms.length > 0 && terms.every((t) => new RegExp(`\\b${escape(t)}${t.length < 4 ? '\\b' : ''}`, 'i').test(text));
}

export const matches = (hit: Hit, query: string) => matchesText(`${hit.title} ${hit.teaser ?? ''}`, query);
