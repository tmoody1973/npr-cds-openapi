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

// homeStation is the configured station id; naming it in step 1 keeps a word search from reading NPR as "ours".
export function newsletterDraft(args: { topic?: string; since?: string; station?: string }, homeStation?: string): string {
  const topic = args.topic ? ` about "${args.topic}"` : '';
  const since = args.since ?? daysAgo(7);
  const ours = args.station ?? homeStation;
  return `Draft a station newsletter section${topic} for ${ours ? `"${ours}"` : 'the home station'}, covering everything since ${since}.

1. Call find_stories with ${args.topic ? `query="${args.topic}", ` : ''}since="${since}"${ours ? `, station="${ours}"` : ''}, limit=10. These are our own stories.
2. Call find_stories with the same words and window but station="NPR", limit=10. These are NPR's.

Write it in the station's voice, for members:
- Lead with our own stories. One or two sentences each, then the canonical link back to the story on our site, then the audio link if there is one.
- Follow with up to three NPR stories, one sentence each, each with "via NPR" and the canonical link back to npr.org.
- Every item must link back to its source. Do not store, copy, or quote at length any NPR or other station's text; a one-sentence summary and the link is the whole use.
- End with one line inviting members to listen or read more.`;
}

// The station clause the prompts pass to the tools: the one asked for, else the configured home station.
const stationClause = (station?: string, homeStation?: string) => { const ours = station ?? homeStation; return { ours, st: ours ? `, station="${ours}"` : '' }; };

export function weeklyPrep(args: { since?: string; station?: string }, homeStation?: string): string {
  const since = args.since ?? daysAgo(7);
  const { ours, st } = stationClause(args.station, homeStation);
  return `You are preparing the weekly editorial prep for ${ours ? `the station "${ours}"` : 'the home station'}: the week in review, what the network covered that we did not, and the week ahead. Work in this order and do not skip steps.

1. Call whats_new_since with since="${since}"${st}. These are our own stories from the week, new and updated.
2. Pick the two subjects that come up most in step 1. For each, call coverage_gap with topic=<subject>, since="${since}". This shows NPR's stories on that subject and whether we localized them.
3. Call find_stories with station="NPR", since="${since}", limit=20. This is NPR's week.
4. Call find_stories with station="NPR", kind="podcasts", since="${since}", limit=10. These are the newest NPR podcast episodes, for planning.

Then write the prep so an editor can read it in five minutes:
- THE WEEK IN REVIEW: our stories grouped by subject, each as a headline, one sentence, the canonical link, and the audio length if there is audio.
- WHAT WE MISSED: from step 2, the NPR stories not marked localized, each with one sentence on the local angle and its canonical link.
- WEEK AHEAD: from steps 3 and 4, three NPR stories or episodes worth planning a local angle on this coming week, each with its canonical link.
- Never invent a story or a quote. Everything comes from the tool results. If a step returns nothing, say so.`;
}

export function showPrep(args: { show: string; since?: string; station?: string }, homeStation?: string): string {
  if (!args.show) throw new Error('show-prep needs a show name.');
  const since = args.since ?? daysAgo(14);
  const { ours, st } = stationClause(args.station, homeStation);
  return `You are preparing a host for the next "${args.show}" on ${ours ? `the station "${ours}"` : 'the home station'}. Work in this order and do not skip steps.

1. Call find_stories with show="${args.show}"${st}, limit=10. These are the show's recent episodes; note their guests and subjects.
2. Pick the subject or guest that appears most in step 1. Call coverage_scan with topic=<that>, since="${since}". This is what NPR and the network said about it.
3. Call find_stories with station="NPR", query=<the same words>, since="${since}", limit=10. NPR's own stories on it.

Then write the prep so the host can scan it before air:
- LAST TIME ON THE SHOW: the three newest episodes, each as a headline, one sentence, the canonical link, and the audio link if there is audio.
- THE NETWORK ON OUR BEAT: from step 2, up to five stories grouped by station, one sentence each, each with the canonical link and "(station name)".
- FROM NPR: up to three from step 3, one sentence each, each ending "(NPR, link)" with the canonical link.
- THREE QUESTIONS: three questions the host could ask next episode, each grounded in one of the stories above.
- Never invent a story, a guest, or a quote. Everything comes from the tool results. If a step returns nothing, say so.`;
}
