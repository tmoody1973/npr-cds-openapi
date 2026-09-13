# README prompt run against 0.7.0, 2026-09-12

How: each of the twenty README prompts (plus one variant) was sent to a fresh headless Claude (`claude -p`, sonnet, Claude Code 2.1.270) with only the `npr-cds` server loaded, pinned to `npr-cds-mcp@0.7.0`, home station s921. That is a real assistant choosing tools from the prompt text alone, with no project instructions. Cost: about $1.80 for 24 runs. Raw logs stayed in the session scratchpad; the `searched` line from each run is below.

Verdict in one line: every tool that the assistant reached returned a correct result. The failures are one protocol bug, one scoping rule, and four places where the assistant did not pick the right tool because nothing told it to.

## The 0.8.0 list

### HIGH-1: `find_station` and `find_collection` are rejected by the MCP client

Both return a plain list as `structuredContent`. The MCP client in Claude Code 2.1.270 requires an object there and refuses the whole result: `MCP error -32602: Invalid tools/call result ... expected record, received array`. Confirmed on 0.5.1 and 0.7.0. Prompt 2 ("What's WXPN's station id? And KEXP?") and prompt 16 ("Newest stories from Radio Nowhere") both failed outright; prompt 3 lost two turns to it.

Fix: in `register.ts`, the `text()` helper should wrap lists, e.g. `structuredContent: Array.isArray(data) ? { results: data } : data`, and `register.test.ts` should assert that every tool's structured result is an object.

### HIGH-2: word search without a station reads NPR only, so local stories are missed

**Done in 0.8.0.**

`find.ts` `scanKeyword` scopes the title-and-teaser scan to NPR unless a station is named (deliberate, to bound the scan). Show-name lookups, by contrast, learn from the home station first. Effects seen:

- Prompt 17 "Read me the Danielle Ponder story" → `searched: collections "Danielle Ponder" (1112238605); keyword "Danielle Ponder" over 300 newest NPR stories` → read a 2020 NPR Tiny Desk piece, not the Ladies First episode.
- Prompt 18 "What did we run on Summerfest in 2023?" → first call `keyword "Summerfest" over 900 newest NPR stories`; the assistant had to call again with `station: Radio Milwaukee` before it got ours.
- Prompt 12 (`newsletter-draft music`) → the "our own stories" step returned NPR and WBUR items (see MEDIUM-3).

Fix: when no station is named and a home station is configured, scan the home station's newest page as well as NPR's, home first, and say so in the `searched` line ("over 300 newest 88Nine stories and 600 newest NPR stories"). One extra request per word query.

### MEDIUM-3: `newsletter-draft` labels NPR's stories as ours

**Done in 0.8.0.**

`prompts.ts` `newsletterDraft` step 1 calls `find_stories` without a station when none is given, which under HIGH-2 means NPR. Fix: pass the home station id from `deps.homeStation` (available in `register.ts`) into the template, or fix HIGH-2 and pass `station` explicitly anyway.

### MEDIUM-4: "Who in the network covered housing this week?" never reached `coverage_scan`

Prompt 19: the assistant used `find_stories` (NPR-only scan) and then told the user "no member-station-specific housing coverage turned up", which it had not checked. Fix: `coverage_scan`'s description should carry the trigger phrases ("who in the network", "which stations", "across stations"), and `find_stories`'s description should state its default scope in one clause so the assistant cannot claim network coverage from it.

### MEDIUM-5: "What's my home station?" has no tool to answer it

Prompt 1: no tool call, the assistant asked the user. Fix: register the server with an `instructions` string ("Home station: 88Nine Radio Milwaukee (s921). Stories, episodes and newscasts mean CDS content; use find_stories, then read_story.") The SDK sends it to the client at connect. The same string fixes MEDIUM-6.

### MEDIUM-6: "Read me the X story" is not recognised as a CDS request

Prompt 17, first run: no tool call; the assistant looked for a file. Same fix as MEDIUM-5.

### LOW-7: "episodes" makes the assistant guess `kind: podcasts` for a show

Prompt 3: `find_stories {show: "Ladies First", kind: "podcasts"}` → "No show or collection matches". The error could say the name matched a show, not a podcast, and to drop `kind`.

### LOW-8: three tools have no `searched` line

`latest_newscast`, `station_labels` and the two lookups return none; the README says every result has one. Add a one-liner to each.

### LOW-9: README prompt 10's sample url is not a real story

`.../2026-09-11/danielle-ponder` 404s; the real slug ends `-everything-has-changed`. The README should carry a url that resolves.

### Added 2026-09-13 from the station desk spec (cds-showroom `docs/superpowers/specs/2026-09-13-station-desk-design.md`)

These are features, not bugs; they gate phases 1, 2 and 4 of the desk.

- **Done in 0.8.0.** **FEAT-10: images and bylines in compact hits and in `read_story`.** CDS documents carry `images[]` with one enclosure per crop and `hrefTemplate` for resizing, and `bylines[]`; `toHit` skips both today. Add `image: { href, credit?, caption? }` (a wide crop via the template) and `byline: string` to hits, and image plus byline to `read_story`. In a 24-hour sample, 109 of 143 stories had an image and 101 a byline.
- **Done in 0.8.0.** **FEAT-11: state, city, and format in the station directory.** The finder returns `brand.marketCity`, `brand.marketState`, `brand.band`, `eligibility.musicOnly`; the catalog keeps only id, name, call, city. Keep state and format so a client can group stations by state.
- **Done in 0.8.0.** **FEAT-12: `weekly-prep` prompt.** Week in review for the home station, what the network covered that the station did not (`coverage_gap`), and the week ahead from NPR programs and podcasts. Same shape as `morning-prep`, `since` defaulting to seven days back.
- **Done in 0.8.0.** **FEAT-13: `show-prep` prompt.** Takes a show name; its recent episodes (`find_stories` with the collection), network stories on its beat, other stations on the same guests or topics (`coverage_scan`). Every item with its canonical link and audio link.

## Results by prompt

| # | Prompt | Result | `searched` |
|---|---|---|---|
| 1 | What's my home station? | asked the user (MEDIUM-5) | none |
| 2 | WXPN and KEXP ids | failed (HIGH-1); probe run earlier got s715/s79 via `station_labels` | none |
| 3 | Three newest Ladies First episodes | correct after 6 calls (HIGH-1, LOW-7) | station 88Nine Radio Milwaukee (s921); collections "Ladies First" (g-s921-13049); keyword "Ladies First" over 300 newest podcast episodes |
| 4 | Latest NPR newscast | correct, premium note present | none (LOW-8) |
| 5 | morning-prep | correct: ours, five NPR, newscast, three talk breaks | stories from 88Nine Radio Milwaukee edited or published since 2026-09-11T06:00:00-05:00 |
| 6 | Latest NPR stories about AI | correct, eight stories | collections "AI" (479274800), "Understanding AI" (g-s1-133533); keyword "AI" over 600 newest NPR stories |
| 7 | NPR and KCRW on housing this week | correct; KCRW had none this week | station KCRW (s55); collections "housing market" (137081712); keyword "housing" over 6 newest stories |
| 8 | What changed since 8am? | correct: nothing (Saturday) | stories from 88Nine Radio Milwaukee edited or published since 2026-09-12T08:00:00-05:00 |
| 9 | Our Summerfest coverage from 2023 | correct via the Summerfest collection | published 2023-01-01 to 2023-12-31; collections "Summerfest" (1209445150); keyword "Summerfest" over 900 newest NPR stories |
| 10 | Why isn't this story on the site? | correct with a real url: found, show, audio 29 min, image, teaser, no problems | newest 300 stories from 88Nine Radio Milwaukee |
| 11 | What labels do we use? | correct, matches README table | none (LOW-8) |
| 12 | newsletter-draft music | wrong: "ours" were NPR and WBUR (MEDIUM-3) | collections "Music" (1039), "Music Reviews" (1104), "Music Interviews" (1105); keyword "music" over 300 newest NPR stories |
| 13 | Newest This Bites episodes | correct, nine episodes | collections "This Bites" (718413877) |
| 14 | NPR podcasts about AI | correct, premium note each | collections "AI", "Understanding AI"; keyword "AI" over 900 newest NPR podcast episodes |
| 15 | Download the newscast MP3 | refused correctly, gave the link and expiry | none |
| 16 | Newest stories from Radio Nowhere | failed (HIGH-1); no clean "no station matches" | keyword "Radio Nowhere" over 300 newest NPR stories |
| 17 | Read me the Danielle Ponder story | run 1 no tool call (MEDIUM-6); run 2 read the wrong, NPR, story (HIGH-2) | collections "Danielle Ponder" (1112238605); keyword "Danielle Ponder" over 300 newest NPR stories |
| 17b | Read the newest NPR radio segment about AI | correct, transcript of the ATC segment | collections "AI", "Understanding AI"; keyword "AI" over 300 newest NPR stories |
| 18 | What did we run on Summerfest in 2023? | correct on the second call, station named (HIGH-2) | published 2023-01-01 to 2023-12-31; station 88Nine Radio Milwaukee (s921); collections "Summerfest" (1209445150); keyword "Summerfest" over 128 newest stories |
| 19 | Who in the network covered housing this week? | misleading (MEDIUM-4) | published 2026-09-06 to 2026-09-12; collections "housing market" (137081712); keyword "housing" over 396 newest NPR stories |
| 20 | NPR on AI this week we haven't localized | correct: seven NPR stories, all gaps | "AI" since 2026-09-05: NPR (300 read) against ours (station s921; keyword "AI" over 10 newest stories) |

## Harness notes, not server bugs

- A headless Claude Code run keeps auto-memory. Run 13 wrote a memory file claiming the user co-hosts This Bites; run 18 read it and searched only that podcast. Deleted; 10, 17 and 18 were re-run in isolated folders. Future prompt runs should use a fresh working directory per run.
- Claude Code defers MCP tools behind `ToolSearch`, so every run spends one turn loading tool definitions. A plain MCP client would not.
