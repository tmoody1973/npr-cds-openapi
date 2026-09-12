// Saved workflows. A prompt is a recipe the assistant follows the same way every time; these
// name the tools to call, in order, and the shape of what to hand back.

// Local-time ISO string, e.g. 2026-09-11T06:00:00-05:00, so the tools can parse it.
export function localIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset(); const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}
const yesterdayAt6 = () => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(6, 0, 0, 0); return localIso(d); };
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return localIso(d).slice(0, 10); };

export function morningPrep(args: { since?: string; station?: string }): string {
  const since = args.since ?? yesterdayAt6();
  const who = args.station ? `the station "${args.station}"` : 'the home station (leave station unset)';
  return `You are preparing a morning show rundown for ${who}. Work in this order and do not skip steps.

1. Call whats_new_since with since="${since}"${args.station ? ` and station="${args.station}"` : ''}. These are our own stories, new and updated.
2. Call find_stories with station="NPR", since="${since}", limit=15. This is what NPR published in the same window.
3. Call latest_newscast. This is the newest NPR newscast: note its length in minutes and its publish time.

Then write the rundown so a host can read out loud:
- Open with one line: the date, how many of our stories are new, and when the newest NPR newscast was cut.
- OUR STORIES: each as a headline, then one spoken sentence from the teaser, then the audio length if there is audio. Newest first.
- FROM NPR: the five strongest for our audience, same shape, each ending with "(NPR, link)" and the canonical url.
- TALK BREAKS: three suggested 20-second talk breaks that connect an NPR story to something local.
- Never invent a story or a quote. Everything comes from the tool results. If a step returns nothing, say so in the rundown.`;
}

export function newsletterDraft(args: { topic?: string; since?: string; station?: string }): string {
  const topic = args.topic ? ` about "${args.topic}"` : '';
  const since = args.since ?? daysAgo(7);
  return `Draft a station newsletter section${topic} for ${args.station ? `"${args.station}"` : 'the home station'}, covering everything since ${since}.

1. Call find_stories with ${args.topic ? `query="${args.topic}", ` : ''}since="${since}"${args.station ? `, station="${args.station}"` : ''}, limit=10. These are our own stories.
2. Call find_stories with the same words and window but station="NPR", limit=10. These are NPR's.

Write it in the station's voice, for members:
- Lead with our own stories. One or two sentences each, then the canonical link back to the story on our site, then the audio link if there is one.
- Follow with up to three NPR stories, one sentence each, each with "via NPR" and the canonical link back to npr.org.
- Every item must link back to its source. Do not store, copy, or quote at length any NPR or other station's text; a one-sentence summary and the link is the whole use.
- End with one line inviting members to listen or read more.`;
}
