# Demo prompts: showing what CDS can do for a radio station

Twenty things to say out loud to an assistant wired to `npr-cds-mcp`. Every example uses NPR and other member stations, so this page works as a demo at any station, in any room, before anyone has set up their own content. Swap in your own call letters wherever you like.

These are not the setup tests in the README; those prove the plumbing works. These are for the moment someone asks *what would I use this for?*

**How to read each demo.** *Say this* is the prompt. *Why it lands* is the point for the person watching. *Behind it* names the tools, so a developer in the room knows what ran. *It worked when* is what a correct answer looks like, so nobody applauds a wrong one.

**What was real on 2026-09-16**, run through the tools while writing this page, so you know the shapes are honest:

- NPR's 8AM newscast: "NPR News: 09-16-2026 8AM EDT", 4 minutes 40 seconds, published 8:10am, link expires 9:20am, marked *premium audio: play or link to it, never store*.
- All Things Considered's newest three from September 15: Turkish households hoarding gold (4:18), what to make of warnings that AI may pose an existential threat (6:34), a rare glimpse inside Israeli-occupied southern Lebanon (4:42).
- KCRW (s55) newest: a Compton film festival (4:17), Orange County's shrinking coastline (5:13), LA protections for mom-and-pop businesses (4:33), all KCRW Reports, all marked display-only.
- WBEZ (s308) newest: how Chicago's arts spending compares with other cities, and Mayor Johnson launching his reelection campaign.
- KCRW's own labels: shows Favorite Sessions (112) and Metropolis (53); podcasts Press Play with Madeleine Brand (77), The Treatment (41), Good Food (36); topic Music (175). From its newest 300 stories and 300 episodes.

---

## The 6am hour

**1. A run of show, built while the coffee brews**

- *Say this:* "It's 5:40. Build me the 6 o'clock hour: the newest NPR newscast with its exact length, three All Things Considered segments from yesterday with their runtimes, and two 20-second talk breaks. Mark anything I can't store."
- *Why it lands:* the thing a morning producer does by hand across four tabs arrives as one readable page, already marked for rights.
- *Behind it:* `latest_newscast`, `find_stories`.
- *It worked when:* the newscast carries its publish time and length, each segment has a real runtime, and the premium-audio note says play or link, never store.

**2. The 45-second read**

- *Say this:* "Read me NPR's story about warnings that AI could be an existential threat. Keep every number and name exactly as written, and tell me if anything I'd want to say on air isn't in the text."
- *Why it lands:* the host hears the actual copy, and hears where it's thin, before the mic opens.
- *Behind it:* `read_story`.
- *It worked when:* for a radio piece with no written body it offers the transcript, or says plainly that CDS holds only the teaser and audio, instead of paraphrasing from memory.

**3. The overnight change**

- *Say this:* "Has NPR published or updated anything since midnight that changes the top of my 7 o'clock?"
- *Why it lands:* the correction you would have missed, found in one question.
- *Behind it:* `whats_new_since`.
- *It worked when:* items are marked *new* or *updated*, newest change first, and nothing outside that window appears.

**4. A fill-in host's cheat sheet**

- *Say this:* "I'm filling in tomorrow and the beat is climate. What has NPR run in the last two weeks, what have member stations run, and give me three questions I could actually ask."
- *Why it lands:* someone who has never covered the beat walks in prepared, with links.
- *Behind it:* `coverage_scan`, `find_stories`, and the saved prompt `show-prep` when the beat is a show.
- *It worked when:* every item links back to its source and the three questions follow from those items rather than from thin air.

## The pitch meeting

**5. Five local angles, with the reporting already attached**

- *Say this:* "Take NPR's housing coverage this week and give me five local angles for a mid-size city. For each: the NPR story link, and the one thing a local version would need that the network piece doesn't have."
- *Why it lands:* a budget meeting that starts from what the network already reported.
- *Behind it:* `coverage_scan`, `coverage_gap`.
- *It worked when:* each angle names a real NPR story, and the gap flags read as hints for a human to judge, not as verdicts.

**6. What another station is actually covering**

- *Say this:* "What does KCRW publish most? Give me their shows, podcasts and topics with counts, then tell me what that says about their newsroom."
- *Why it lands:* a competitor's, or a peer's, whole editorial shape in one answer.
- *Behind it:* `station_labels`.
- *It worked when:* the labels are exact CDS names with counts, and the answer says the counts come from the newest few hundred items, not from all time.

**7. Two cities, one question**

- *Say this:* "Compare how KCRW and WBEZ covered housing this month: how many pieces each, and what angle each took."
- *Why it lands:* two markets side by side, without opening either website.
- *Behind it:* `find_stories`, `coverage_scan`.
- *It worked when:* both lists carry the display-only note, and it says how far back it looked.

**8. The week, without the week's meetings**

- *Say this:* "Run weekly prep for the network since Monday and end with the three things you'd put on a budget board."
- *Why it lands:* the Monday editorial memo, written from what actually happened.
- *Behind it:* the saved prompt `weekly-prep` (`since` defaults to seven days ago).
- *It worked when:* the review and the gap section are traceable to items above them, each with a link.

## The archive

**9. The anniversary piece**

- *Say this:* "It's the anniversary of a major hurricane. Pull NPR's coverage from 2023 and 2024, group by year, and flag which pieces have audio."
- *Why it lands:* two years of network coverage that would otherwise be a long search nobody has time for.
- *Behind it:* `search_archive` (it walks back in half-year windows and reports how many it read).
- *It worked when:* it names the windows it scanned, and offers to keep going rather than pretending it reached the end.

**10. The re-air check**

- *Say this:* "We want to re-run an NPR segment about the Tiny Desk concerts. Find every candidate, newest first, and tell me which ones we may only link to rather than store."
- *Why it lands:* the producer finds the right tape and the right permission in one pass.
- *Behind it:* `find_stories`, `read_story`.
- *It worked when:* each hit carries its date and audio length, and premium items are marked play-or-link.

**11. The obituary drawer**

- *Say this:* "A musician NPR has covered for decades has died. Find every NPR story and podcast episode featuring them, oldest to newest, with audio, so I can build a tribute."
- *Why it lands:* the worst-timed research task in radio, done in one pass.
- *Behind it:* `search_archive`, `find_stories`.
- *It worked when:* the order is the one you asked for, and podcast episodes carry their premium note.

## Newsletter and socials

**12. The newsletter that writes its own first draft**

- *Say this:* "Draft a music newsletter section from the network since Monday: NPR first, then two member stations, one or two sentences each, every item linking back. Mark anything whose audio we can only link to."
- *Why it lands:* the weekly email, already sourced and rights-marked.
- *Behind it:* the saved prompt `newsletter-draft` (takes a topic and a since date).
- *It worked when:* every item has a working link, and premium or other-station audio carries its note.

**13. Three posts from three episodes**

- *Say this:* "Turn the three newest Fresh Air episodes into 40-word posts, each ending with its link, in the show's voice rather than a press release's."
- *Why it lands:* social copy written from the actual episode text, not from the title.
- *Behind it:* `find_stories` with `kind: podcasts`, `read_story`.
- *It worked when:* each post says something specific from the episode, and the premium note is there, because NPR podcast audio is play-or-link.

**14. The month in one paragraph**

- *Say this:* "Write a sponsor-facing paragraph about what NPR published on climate this month: how many pieces, which programs, the three biggest angles. Numbers only from what's in CDS."
- *Why it lands:* the summary that usually gets estimated, with its window stated.
- *Behind it:* `find_stories`, `station_labels`.
- *It worked when:* it gives counts with their window and says what the counts don't include rather than rounding up.

## The website

**15. The ticket that says "my story isn't live"**

- *Say this:* "Here are three story URLs. For each: is it in CDS, what's missing, and what would fix it? Rank them by how long the fix takes."
- *Why it lands:* the daily CMS mystery answered in plain words, in bulk. Works on any station's URL.
- *Behind it:* `check_story`.
- *It worked when:* each answer names the actual missing piece (a Show label, audio attached as a link, no teaser), not a generic "check your CMS".

**16. Before the site migration**

- *Say this:* "We're rebuilding a station site. Show me the exact show, podcast, topic, tag and category names CDS holds for KCRW, with counts, as a model for our taxonomy. Flag any name that looks like a duplicate or a typo."
- *Why it lands:* a real, working taxonomy to copy from, generated from the data.
- *Behind it:* `station_labels`.
- *It worked when:* spelling matches CDS exactly, and near-duplicates are flagged as *looks like* rather than merged for you.

**17. The freshness audit**

- *Say this:* "Audit WBEZ's newest 25 stories: which are missing a teaser, an image, or audio? Give me a list a digital team could work from."
- *Why it lands:* the quality sweep nobody runs because it takes an afternoon, demonstrated on a real newsroom.
- *Behind it:* `find_stories`, `check_story`.
- *It worked when:* the list is per story with the specific gap named, and it says how many it checked.

## The rest of the network

**18. Who else is on this story**

- *Say this:* "Which member stations covered immigration enforcement this week, and what did each lead with?"
- *Why it lands:* the network's coverage in one view, useful to a local editor and a network producer alike.
- *Behind it:* `coverage_scan`.
- *It worked when:* it groups by station, NPR first, and every station's item carries the display-only note.

**19. The station you've never heard of**

- *Say this:* "What's the station in Philadelphia on this network, and what have they published this week?"
- *Why it lands:* no ids, no directory lookup, no guessing at call letters.
- *Behind it:* `find_station`, `find_stories`.
- *It worked when:* it names the station and its id, and the stories are that station's own.

**20. Where it says no**

- *Say this:* "Download the newest NPR newscast so we can drop it into our podcast feed."
- *Why it lands:* the demo's best moment. The tool refuses, explains that this is premium audio you may play or link but not store, and hands you the stream link anyway.
- *Behind it:* `latest_newscast` plus the rights rules carried in every answer.
- *It worked when:* it says no clearly, says why in one sentence, and still gives you the legitimate way to use it.

---

## A five-minute demo

Run these four in order. It tells a story: a morning, a meeting, an archive, and a limit.

1. **Demo 1** (run of show). "This is what a producer does at 5:40am."
2. **Demo 5** (five local angles). "This is Monday's budget meeting, sourced."
3. **Demo 9** (anniversary). "Two years of network coverage, in one question."
4. **Demo 20** (the refusal). "And it knows what we're not allowed to do."

Then the line that matters: nobody typed a station id, opened a CMS, or read a line of JSON.

## What to say when someone asks how it works

CDS is NPR's Content Distribution Service: the shared shelf the network's stories and every member station's sit on. This assistant has eleven tools that ask it in station language — a show name, a city, a date window — instead of ids. Ask in plain words; it picks a tool, reads the result, and answers from what came back.

## Cautions worth saying out loud during a demo

- **Every answer comes from a tool result.** If CDS doesn't have it, the honest answer is "not in CDS", and that is the answer you want.
- **Rights travel with the content.** Other stations' items are marked display-only; NPR's premium audio is play-or-link, never store. The tool marks it; a human still decides.
- **Gap flags are hints.** "Nobody localized this" means no obvious match was found, not that no one covered it.
- **Counts carry their window.** Label counts come from the newest few hundred items, not from all time, and the answer says so.
- **About half of NPR's stories carry body text in CDS.** For the rest you get a transcript, or a note plus the link. Better to see that in a demo than in front of a host.
- **Runtimes are the file's, not the clock's.** A four-minute forty-second newscast is 4:40 of audio; your hour still needs its own timing.
