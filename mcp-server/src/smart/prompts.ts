// Saved workflows. A prompt is a recipe the assistant follows the same way every time; these
// name the tools to call, in order, and the shape of what to hand back.

export function morningPrep(args: { since?: string; station?: string }): string {
  const since = args.since ?? 'yesterday at 6am local time';
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
  const since = args.since ?? 'the last 7 days';
  return `Draft a station newsletter section${topic} for ${args.station ? `"${args.station}"` : 'the home station'}, covering ${since}.

1. Call find_stories with ${args.topic ? `query="${args.topic}", ` : ''}since="${since}"${args.station ? `, station="${args.station}"` : ''}, limit=10. These are our own stories.
2. Call find_stories with the same words and window but station="NPR", limit=10. These are NPR's.

Write it in the station's voice, for members:
- Lead with our own stories. One or two sentences each, then the canonical link back to the story on our site, then the audio link if there is one.
- Follow with up to three NPR stories, one sentence each, each with "via NPR" and the canonical link back to npr.org.
- Every item must link back to its source. Do not store, copy, or quote at length any NPR or other station's text; a one-sentence summary and the link is the whole use.
- End with one line inviting members to listen or read more.`;
}
