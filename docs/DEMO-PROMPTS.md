# Demo prompts: showing what CDS can do for a radio station

Twenty things to say out loud to an assistant wired to `npr-cds-mcp`, chosen because each one is hard, slow, or impossible without it. They are not the setup tests in the README; those prove the plumbing works. These are for the moment someone asks *what would I use this for?*

**How to use this page.** Paste a prompt, swap in your own station, shows and subjects. Radio Milwaukee's names are here because they are real: Ladies First, This Bites, In the Mix, La Alternativa, HYFIN. Everything the assistant says comes from a tool result: if a fact is not in CDS, it says so instead of filling the gap.

**Each demo has four lines.** *Say this* is the prompt. *Why it lands* is the point for the person watching. *Behind it* names the tools, so a developer in the room knows what ran. *It worked when* is what a correct answer looks like, so nobody applauds a wrong one.

---

## The 6am hour

**1. A run of show, built while the coffee brews**

- *Say this:* "It's 5:40. Build me the 6 o'clock hour: our three newest stories, the newest NPR newscast with its length, and two 20-second talk breaks. Mark anything I can't play on air."
- *Why it lands:* the thing a morning producer does by hand across four tabs arrives as one readable page, already marked for rights.
- *Behind it:* `whats_new_since`, `find_stories`, `latest_newscast`.
- *It worked when:* the newscast line carries its publish time and length, and the premium-audio note says play or link, never store.

**2. The 45-second read**

- *Say this:* "Read me the top story in about 45 seconds of speech. Keep every number and name exactly as written, and tell me if anything I'd want to say isn't in the text."
- *Why it lands:* the host hears the actual copy, and hears where the copy is thin, before the mic opens.
- *Behind it:* `read_story`.
- *It worked when:* it reads the paragraphs, and for an NPR radio piece with no written body it says so and offers the transcript or the link instead of paraphrasing from memory.

**3. The overnight change**

- *Say this:* "Did anything published or edited since midnight change what I just wrote for the 7 o'clock?"
- *Why it lands:* the correction you would have missed, found in one question.
- *Behind it:* `whats_new_since`.
- *It worked when:* items are marked *new* or *updated*, newest change first, and it names nothing outside that window.

**4. A fill-in host's cheat sheet**

- *Say this:* "I'm filling in on In the Mix tomorrow. What has run on the show in the last two weeks, what has the network said on that beat, and give me three questions I could actually ask."
- *Why it lands:* someone who has never hosted the show walks in prepared.
- *Behind it:* the saved prompt `show-prep` (it takes a show name; `since` defaults to fourteen days ago).
- *It worked when:* every episode and every network item links back to its source, and the three questions follow from those items rather than from thin air.

## The pitch meeting

**5. Five local angles, with the reporting already attached**

- *Say this:* "Give me five local angles on what NPR published about housing this week. For each one: the NPR story link, and the one thing a Milwaukee version would need that we don't already have."
- *Why it lands:* a budget meeting that starts from what the network already reported, not from memory.
- *Behind it:* `coverage_gap`, `coverage_scan`.
- *It worked when:* each angle names a real NPR story, and the gap flags read as hints for a human to judge, not as verdicts.

**6. What we are actually covering**

- *Say this:* "What subjects have we published most in the last 30 days, by our own label names, and which of those has NPR not touched at all?"
- *Why it lands:* the newsroom's real beat map, from what shipped, not from the beat memo.
- *Behind it:* `station_labels`, `find_stories`, `coverage_gap`.
- *It worked when:* the label names match your CMS exactly, spelling and all, with counts, and it says the counts come from the newest few hundred stories.

**7. The show that went quiet**

- *Say this:* "Which of our shows and podcasts published nothing in the last 14 days, and when did each last publish?"
- *Why it lands:* the schedule gap nobody notices until a listener asks.
- *Behind it:* `station_labels`, `find_stories`.
- *It worked when:* every show it names has a real last-published date, and shows with no CDS presence at all are called out as such rather than reported as silent.

**8. The week, without the week's meetings**

- *Say this:* "Run weekly prep since Monday and end with the three things you'd put on the board for next week."
- *Why it lands:* the Monday editorial memo, written from what happened.
- *Behind it:* the saved prompt `weekly-prep` (`since` defaults to seven days ago).
- *It worked when:* the week in review is ours, the gap section is the network's, and the three board items are traceable to items above them.

## The archive

**9. The anniversary piece**

- *Say this:* "Summerfest again this year. Pull everything we ran about it in 2023 and 2024, group it by year, and flag which ones have audio we could re-air."
- *Why it lands:* two years of coverage that would otherwise be a CMS search nobody has time for.
- *Behind it:* `search_archive` (it walks back in half-year windows and says how many it read).
- *It worked when:* it reports the windows it scanned, and offers to keep going rather than pretending it reached the end.

**10. The re-air check**

- *Say this:* "We want to re-air our Womack Sisters segment. Find every time we covered them, newest first, and tell me which version has audio attached."
- *Why it lands:* the producer finds the best tape instead of the first hit.
- *Behind it:* `find_stories`, `search_archive`, `read_story`.
- *It worked when:* each hit carries its date and audio length, and it distinguishes attached audio from a link out.

**11. The obituary drawer**

- *Say this:* "A local musician we've covered has died. Find every story and episode where we featured them, oldest to newest, with the audio, so I can build a tribute segment."
- *Why it lands:* the worst-timed research task in radio, done in one pass.
- *Behind it:* `search_archive`, `find_stories`.
- *It worked when:* the order is the one you asked for, and anything from another station comes back marked display-only.

## Newsletter and socials

**12. The newsletter that writes its own first draft**

- *Say this:* "Draft the music section since Monday: ours first, then up to three from NPR, one or two sentences each, every item linking back. Mark any item whose audio we can only link to."
- *Why it lands:* the weekly email, already sourced, already rights-marked.
- *Behind it:* the saved prompt `newsletter-draft` (takes a topic and a since date).
- *It worked when:* every item has a working link, and premium or other-station audio carries its note.

**13. Three posts from three episodes**

- *Say this:* "Turn the three newest Ladies First episodes into 40-word posts, each ending with its link, in the show's voice rather than a press release's."
- *Why it lands:* social copy from the actual episode text, not from the title.
- *Behind it:* `find_stories`, `read_story`.
- *It worked when:* each post says something specific from the episode, and the link is the public one.

**14. The month in one paragraph**

- *Say this:* "Write the sponsor-facing paragraph about what our newsroom published this month: how many stories, which shows, the three biggest subjects. Numbers only from what's in CDS."
- *Why it lands:* the underwriting or board summary that usually gets estimated.
- *Behind it:* `find_stories`, `station_labels`.
- *It worked when:* it gives the counts with their window, and says what the counts don't include rather than rounding up.

## The website

**15. The ticket that says "my story isn't live"**

- *Say this:* "Here are three URLs our editors say are broken on the site. For each: is it in CDS, what's missing, and what would fix it? Rank them by how long the fix takes."
- *Why it lands:* the daily CMS mystery answered in plain words, in bulk.
- *Behind it:* `check_story`.
- *It worked when:* each answer names the actual missing piece (a Show label, audio attached as a link, no teaser), not a generic "check your CMS".

**16. Before the site migration**

- *Say this:* "We're rebuilding the site. Give me the exact show, podcast, topic, tag and category names CDS holds for us, with counts, so I can map them to the new taxonomy. Flag any name that looks like a duplicate or a typo."
- *Why it lands:* the migration spreadsheet, generated from the data rather than from a hope.
- *Behind it:* `station_labels`.
- *It worked when:* the spelling matches CDS exactly, and near-duplicates are flagged as *looks like* rather than merged for you.

**17. The freshness audit**

- *Say this:* "Audit our newest 25 stories: which are missing a primary image, a teaser, or audio? Give me a list I can hand to the digital team."
- *Why it lands:* the quality sweep nobody runs because it takes an afternoon.
- *Behind it:* `find_stories`, `check_story`.
- *It worked when:* the list is per story with the specific gap named, and it says how many it checked.

## The rest of the network

**18. Who else is on this story**

- *Say this:* "Who in the network covered the Milwaukee protests this week, and what did each station lead with?"
- *Why it lands:* the network's coverage in one view, useful for both a local editor and a network producer.
- *Behind it:* `coverage_scan`.
- *It worked when:* it groups by station, NPR first, and every other station's item carries the display-only note.

**19. Borrowed vocabulary**

- *Say this:* "KCRW and WXPN both cover new music. What do they call their music shows and topics in CDS, and what do we call ours?"
- *Why it lands:* how the rest of the system labels the thing you're about to label.
- *Behind it:* `find_station`, `station_labels`.
- *It worked when:* it names each station's actual labels with counts, and doesn't invent a taxonomy that isn't there.

**20. Where it says no**

- *Say this:* "Download the newest NPR newscast so we can drop it into our podcast feed."
- *Why it lands:* the demo's best moment. The tool refuses, explains that this is premium audio you may play or link but not store, and hands you the stream link.
- *Behind it:* `latest_newscast` plus the rights rules built into every answer.
- *It worked when:* it says no clearly, says why in one sentence, and still gives you the legitimate way to use it.

---

## A five-minute demo

Run these four in order. It tells a story: a morning, a meeting, an archive, and a limit.

1. **Demo 1** (run of show). "This is what a producer does at 5:40am."
2. **Demo 5** (five local angles). "This is Monday's budget meeting, sourced."
3. **Demo 9** (anniversary). "Two years of our own coverage, in one question."
4. **Demo 20** (the refusal). "And it knows what we're not allowed to do."

Then the line that matters: nobody typed a station id, opened a CMS, or read a line of JSON.

## What to say when someone asks how it works

CDS is NPR's Content Distribution Service: the shared shelf every member station's stories and the network's sit on. This assistant has eleven tools that know how to ask it in station language — a show name, a city, a date window — instead of ids. Ask in plain words; it picks a tool, reads the result, and answers from what came back.

## Cautions worth saying out loud during a demo

- **Every answer comes from a tool result.** If CDS doesn't have it, the honest answer is "not in CDS", and that is the answer you want.
- **Rights travel with the audio.** Other stations' content is marked display-only; NPR's premium audio is play-or-link, never store. The tool marks it; a human still decides.
- **Gap flags are hints.** "We haven't localized this" means no obvious match was found, not that no one covered it.
- **Counts carry their window.** Label counts come from the newest few hundred stories, not from all time, and the answer says so.
- **About half of NPR's stories carry body text in CDS.** For the rest you get a transcript, or a note plus the link. Better to see that in the demo than in front of a host.
