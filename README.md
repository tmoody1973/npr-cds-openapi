# npr-cds-openapi

An OpenAPI 3.1 description of NPR's **Content Distribution Service (CDS)**, the API member stations use to publish and read content. NPR documents CDS in prose at <https://npr.github.io/content-distribution-service/> but does not publish a machine-readable spec. This is that spec, written by Radio Milwaukee's HYFIN team while building [hyfin-grove](https://github.com/tmoody1973/hyfin-grove) and shared so other stations don't have to repeat the work.

**Not affiliated with or endorsed by NPR.** If it disagrees with the official docs, the official docs win. Open an issue.

## What's here

| Path | What it is |
|---|---|
| `openapi.yaml` | The API description: endpoints, parameters, query semantics, responses. |
| `profiles/*.json` | NPR's own JSON Schema for each of the 63 CDS profiles, fetched from `GET /v1/profiles/{name}` and vendored unchanged except for local `$ref` paths. |
| `schemas/*.json` | The 19 shared schemas the profiles reference (`link`, `documentId`, `sizable-asset`, …), from `GET /v1/schemas/{name}`. |
| `scripts/fetch-schemas.mjs` | Re-downloads all of the above. No token needed; those endpoints are public. |
| `scripts/validate-samples.mjs` | Checks real CDS responses against the vendored schemas. |
| `redocly.yaml` | Lint config. |
| `cortex.config.yml`, `cortex-templates/` | Cortex project and the two template overrides (auth header and token setup; smart-tool registration). |
| `mcp-server/` | MCP server, published to npm as `npr-cds-mcp`: generated endpoint tools plus a hand-written smart layer in `src/smart/` (source committed; `dist/` and `node_modules/` are not). |
| `docs/` | Markdown context bundled into the docs site and the MCP server. |
| `scripts/test-mcp.mjs`, `scripts/bench-smart.mjs` | Smoke test and smart-tool benchmark, both driving the MCP server over stdio against live CDS. |
| `scripts/after-generate.mjs` | Restores what Cortex overwrites on regeneration (see below). |
| `docs/decisions/` | Why the server is shaped the way it is. |

The document model is NPR's, not ours: `openapi.yaml` composes the vendored profile schemas (`document` + `publishable` + whatever a document lists in `profiles`) rather than re-describing them. When NPR changes a profile, re-run the fetch script and the spec follows.

## Use it

```bash
pnpm install                        # or npm install
pnpm lint                           # redocly lint openapi.yaml
pnpm bundle                         # one-file dist/openapi.bundled.yaml for generators
pnpm fetch-schemas                  # refresh profiles/ and schemas/ from CDS
```

Validate a real response (needs your own CDS token):

```bash
curl -s -H "Authorization: Bearer $NPR_CDS_TOKEN" \
  'https://content.api.npr.org/v1/documents?profileIds=story&limit=50' > sample.json
pnpm validate sample.json
```

The validator checks every document against `document` + `publishable` + each profile it claims, and every entry in its `assets` bag against its own profiles.

## How it was verified

- `redocly lint` reports the description valid. Two warnings remain on purpose: one comes from NPR's own `no-rels-link` schema, and one flags that the public `GET /v1/profiles` documents no error response, which matches NPR's docs.
- 1,000 documents and 16,925 nested assets from Radio Milwaukee's feed (stories, aggregations, podcast channels) validate with zero failures.
- 151 live documents across `newscast`, `podcast-episode`, `program-episode`, `has-premium-audio` and `has-videos` validate with zero failures.

Verified 2026-09-12 against CDS production. The pagination caps, sort grammar, date-range syntax and boolean logic of repeated parameters are transcribed from NPR's querying page and encoded as constraints and patterns in the spec.


## MCP server: ask CDS questions in plain words

`mcp-server/` is published to npm as **`npr-cds-mcp`** (current version 0.5.0). It is an MCP server, a small program that lets an AI assistant such as Claude use CDS as a tool. You type a question in plain English; the assistant picks a tool, the tool talks to CDS, and the answer comes back as a list a producer can read out loud.

### For radio professionals

**What you get.** An assistant that knows what's in CDS, yours and every other station's, and can answer by name. You never look up an id. You never read raw JSON.

**Setup, once, two lines.** You need a CDS token from NPR Member Partnership (one per person under NPR's terms) and Node.js 20 or newer.

```bash
npx -y npr-cds-mcp setup                              # asks for your token, then "which station are you?"
claude mcp add npr-cds -s user -- npx -y npr-cds-mcp  # Claude Code
```

`setup` saves the token to `~/.config/npr-cds/token` and your station to `~/.config/npr-cds/config.json`, both readable only by you. Type your station's name, call letters, or city; it looks the id up in NPR's directory and shows you the matches. `npx -y npr-cds-mcp station` changes it later. Claude Desktop or any other MCP client takes the same server as JSON:

```json
{ "mcpServers": { "npr-cds": { "command": "npx", "args": ["-y", "npr-cds-mcp"] } } }
```

With a station set, anything from another station comes back marked *display-only*, which is what NPR's terms require. `NPR_CDS_TOKEN` and `NPR_CDS_HOME_STATION` in the environment override the saved files, for CI or shared machines.

**What you can ask.** These are real questions and real answers from September 12, 2026.

| You ask | What comes back |
|---|---|
| "What are the three newest Ladies First episodes?" | Danielle Ponder (Sep 11, 29 min), Blessing Jolie (Sep 4, 23 min), Alemeda (Aug 28, 21 min), each with teaser, link and audio. One call, 2 KB. |
| "Latest NPR stories about AI" | Eight stories: the Anthropic and OpenAI CEOs calling to slow down, a former Anthropic researcher on rogue AI, deepfakes of late-night hosts, and so on. Found by matching the words *and* NPR's AI collections, so nothing filed only under Technology is missed. |
| "Show me the newest KCRW stories" | Eight KCRW Reports segments with audio, newest first, each marked display-only. |
| "Why isn't the Blessing Jolie story on Grove?" (paste the url) | *Found in CDS. Show: Ladies First. Audio attached, 23 min. Primary image: yes. Teaser: yes. No problems.* Or, when something is missing: *No audio attached in Brightspot. The story will show without a player.* |
| "What labels does Radio Milwaukee actually use?" | Shows: La Alternativa (20), What's All This (18), Ladies First (14), In the Mix (13), DJ Takeover (10). Topics: New Music (82), Studio Milwaukee Sessions (15). Categories: Family Fun (40), On Vinyl (23), Milwaukee Music Premiere (20), Summerfest (17), HYFIN (14). From the newest 300 stories. |
| "What changed since yesterday?" | *new* In the Mix: BG Good; *new* Ladies First: Danielle Ponder; *updated* Ladies First: Blessing Jolie, Alemeda, The Womack Sisters. Newest change first. |
| "What's WXPN's station id?" | s715, WXPN, Philadelphia. |
| "Newest This Bites episodes" | Radio Milwaukee's food podcast, three newest episodes with lengths and links. Your station's podcasts are in CDS too: 13 channels, about 1,975 episodes. |
| "NPR podcasts about AI" | Episodes from Up First, Consider This and the rest, each marked *premium audio: play or link, never store*. |
| "Get me the latest NPR newscast" | NPR News 4PM EDT, 5 minutes, published 16:10, with the stream link and a note: premium audio, play or link, never store. |
| "/morning-prep" (a saved prompt) | The assistant runs what's-new, NPR's stories, and the newscast itself, then writes a rundown a host can read out loud, with three talk breaks. |
| "/newsletter-draft housing" | Our housing stories then NPR's, one or two sentences each, every item linking back, audio links included. |

**Real situations.**

- *A digital editor gets a ticket: "my story isn't on the site."* Paste the url into `check_story`. Nine times out of ten the answer is a missing Show label or audio attached as a link instead of a file, and the tool says which.
- *A news director planning a local angle.* "What has NPR published on housing this week?" then "and KCRW?" Same question, different station name.
- *A producer's morning check.* "What changed since 8am?" shows what colleagues published or edited overnight. Or run the `morning-prep` prompt and get the whole rundown.
- *A host between segments.* "Latest NPR newscast?" gives the cut, its length, and the link to play it. It is premium audio: play it, don't keep it.
- *A developer wiring a site to CDS.* `station_labels` gives the exact label names and ids to filter on, and `whats_new_since` is the call an incremental sync loop makes.

**The seven tools**, for when you want to name one directly:

| Tool | Give it | Get back |
|---|---|---|
| `find_stories` | words, a station, a show or podcast, a topic, a date window, any mix; `kind: podcasts` for episodes | compact hits newest first: title, teaser, date, link, audio length and stream link, collection names, and a rights note when the audio is premium or belongs to another station |
| `check_story` | a story url or CDS id | in CDS or not, labels by name, audio, image, teaser, problems in plain language |
| `station_labels` | a station name | shows, podcasts, programs, topics, tags, categories it uses, with counts |
| `whats_new_since` | a date or time, optionally a station | what was published or edited since, each marked new or updated |
| `latest_newscast` | nothing, or `short`, or a station name | the newest newscast: time, length, stream link, and a never-store note when it is premium |
| `find_station` | a name, call letters, or city | station id and name |
| `find_collection` | a topic, tag, show, or program name | its id |

Two saved prompts, `morning-prep` and `newsletter-draft`, chain these tools into a workflow the assistant follows the same way every time; your MCP client lists them next to the tools. The generated tools (`queryDocuments`, `getDocument`, and the rest, one per CDS endpoint) are still there for the full document when you need it.

**Try it: prompts to test the server.** Ten minutes, in order. Each line says what a correct answer looks like, so you know whether it worked, not just whether it answered. Swap in your own station and shows.

*Setup check*

1. "What's my home station?" → It names your station and id without asking you. If it asks, run `npx -y npr-cds-mcp station`.
2. "What's WXPN's station id? And KEXP?" → s715 Philadelphia, s79 Seattle. Answered from NPR's directory, no token needed.

*Host*

3. "What are the three newest Ladies First episodes?" → Three titles with dates, teasers, links, and audio lengths, newest first, in one call. You never typed an id.
4. "Get me the latest NPR newscast." → The most recent hourly cut, about 5 minutes, with the time it was cut and a play link, plus the note that it's premium audio: play or link, never store. Add "the short one" for the 3-minute cut.
5. Run the saved prompt `morning-prep` (in Claude Code, type `/` and pick it; in Claude Desktop it's in the attach menu). → A rundown a host can read out loud: our new and updated stories, five from NPR with links, the newest newscast, and three 20-second talk breaks. Nothing invented; every item came from a tool result.

*Newsroom*

6. "Latest NPR stories about AI." → Eight or so, the newest first, including ones filed only under Technology. The answer says what it searched: which collections and how many stories it scanned.
7. "What has NPR published on housing this week, and what has KCRW?" → Two lists. KCRW's items carry a display-only note; NPR's do too unless NPR is your home station.
8. "What changed since 8am?" → Our stories published or edited since then, each marked *new* or *updated*, newest change first.
9. "Find our coverage of Summerfest from 2023." → Uses a date window to reach past the newest 2,000 stories. If it comes back thin, say "scan more pages."

*Digital*

10. "Why isn't this story on the site?" and paste a story url from your site. → In CDS or not, its Show, topics and tags by name, whether audio and a primary image are attached, whether it has a teaser, and any problems in plain language. Try it on a story you know is missing something.
11. "What labels does our station actually use?" → Shows, podcasts, topics, tags and categories with counts from the newest 300 stories and 300 podcast episodes. The spelling you see here is the spelling CDS has.
12. Run `newsletter-draft` with the topic "music". → Our music stories first, then up to three from NPR, one or two sentences each, every item with a link back and audio where there is audio.

*Podcasts*

13. "Newest This Bites episodes." → Three episodes with lengths and links. Say "podcast" or the assistant will pass `kind: podcasts` on its own.
14. "NPR podcasts about AI." → Episodes from Consider This, 1A, Throughline and the rest, each marked premium: play or link, never store.

*When it should say no*

15. "Download the newscast MP3 for me." → It gives you the link and explains it can't download or store premium audio. That's the terms working, not a bug.
16. "Newest stories from Radio Nowhere." → "No station matches" with a suggestion to try call letters, not a guess.

If any of these misbehave, open an issue with the prompt and the answer. The `searched:` line in every result is the first thing to paste.

**How it works, in order.** You ask for "Ladies First". The server looks the name up in a catalog it keeps (a lookup table, a list of names and ids it has seen before). If the name is missing, it reads your station's newest stories, notes which collections they point to, resolves the ones CDS will serve and infers the rest from the story urls, and remembers them for next time. It then asks CDS for that collection's stories, newest first. Before anything reaches the assistant it trims each 17 KB document down to the dozen fields a person needs, about 100 bytes. For a words question it also scans the newest 300 stories' titles and teasers itself and merges the two lists, so the assistant reads ten good hits instead of three hundred raw ones.

**What's new by version.** 0.2.0: `find_stories`, `find_station`, `find_collection`, compact hits. 0.3.0: `check_story`, `station_labels`, `whats_new_since`. 0.4.0: `setup` asks your station, `latest_newscast`, the `morning-prep` and `newsletter-draft` prompts. 0.5.0: podcasts through `find_stories`, a premium note on every hit that needs one, podcasts in `station_labels`.

**Podcasts.** Ask with `kind: podcasts`, or just say "podcast" and the assistant will. Episodes come back like stories, with the show name resolved from the podcast channel. NPR's podcast episodes all carry the premium flag, so each one says play or link, never store; a station's own podcasts usually don't. Newscasts are excluded from podcast searches and have their own tool.

**What it can't do.** CDS has no text search, so word matching covers titles and teasers of the newest 300 to 1,800 stories per question, scoped to NPR unless you name a station. The catalog learns as it goes; the first question about a new tag can miss what the second finds. Content from other stations may be displayed with attribution and refreshed, not stored, and audio is always a link to NPR's or the station's servers, never a download.

### For developers

The server is generated from the spec by [Cortex](https://github.com/cortex-docs/cortex), one tool per CDS operation, plus a hand-written smart layer in `mcp-server/src/smart/` that does the name resolution, trimming and matching described above. The smart tools are registered from `main.ts`, a template override, so regeneration keeps them. Why this shape: [docs/decisions/001-hybrid-smart-layer.md](docs/decisions/001-hybrid-smart-layer.md).

```bash
pnpm mcp                          # bundle → cortex mcp generate → after-generate → install → build
(cd mcp-server && pnpm test)      # unit tests for the smart layer (node:test, no network)
pnpm test:mcp                     # smoke test against live CDS (needs a token)
node scripts/bench-smart.mjs      # every smart tool through the real server, live CDS
```

**Auth.** Cortex's generated handlers send no authorization header, so `cortex-templates/mcp/handlers.ejs` is a sparse override that reads the token (environment variable first, then the file written by `setup`) and adds `Authorization: Bearer …` on the documents endpoints. `cortex-templates/mcp/main-stdio.ejs` adds the `setup` subcommand and registers the smart tools. Without a token, those tools return a readable message instead of a 401; the public profile and schema tools work regardless. The token is never written to disk by this project and never appears in tool output (the bench script checks).

**Regeneration.** Cortex overwrites `mcp-server/package.json`, `tsconfig.json` and `README.md`. `scripts/after-generate.mjs`, run by `pnpm mcp`, restores the MiniSearch dependency, the `test` script, the test-file exclusion, and copies `docs/PACKAGE_README.md` over the package README so npm shows the right thing. Hand edits to generated files must be mirrored in `cortex-templates/mcp/*.ejs`.

**Cache.** Station names come from NPR's public services directory (686 entries, refreshed daily). Collection names live in `~/.cache/npr-cds/collections.json` (or `$XDG_CACHE_HOME/npr-cds/`), written atomically and merged before each write so two server processes do not overwrite each other.

**Config.** `setup` writes the token and `config.json` (home station) under `~/.config/npr-cds/`. Environment variables win over both files.

**Releasing a new version.** Bump `cdsMcpVersion` in `package.json`, run `pnpm mcp`, `(cd mcp-server && pnpm test)`, `pnpm test:mcp`, `node scripts/bench-smart.mjs`, then `cd mcp-server && npm publish --access public`.

**Why the spec is dereferenced first.** Cortex does not resolve `$ref` inside parameter schemas, so `pnpm bundle` also writes `dist/openapi.dereferenced.yaml` with every reference inlined, and `cortex.config.yml` points at that file. The source of truth stays `openapi.yaml`.

## Things NPR's docs leave open

Marked in the spec where relevant.

- No documented rate limit or `Retry-After`; only a note that `503` means try later.
- `PUT` bodies are profile-dependent; the spec requires the composite `Document` shape.
- `transclude` values listed by NPR are "the most common"; there may be others.
- The subscription endpoint is NPR-internal and not available to member stations.
- Docs say results default to newest-first; observed responses without `sort` were oldest-first. Pass `sort` explicitly.

## Terms of use

CDS access for stations is governed by NPR's *API Terms of Use for Stations* (updated April 30, 2025, in NPR Studio). Every clause in it governs **API Content**: the stories, audio and photos NPR and other providers distribute. None of it restricts describing the interface. This repository contains no API Content, no tokens and no station-private data; the profile schemas it vendors are served by CDS without authentication, and the endpoint paths are already published on NPR's public docs site.

Two clauses matter to anyone building on this spec:

- **Storing content** (clauses 6, 7, 9): non-audio content may be cached for performance and stored only for display on your own noncommercial member platform, and must be refreshed regularly. Content marked premium (clause 4) may not be stored at all. Audio must be served as links from NPR's servers (clause 8).
- **Your own content** (clause 19): a station that publishes its own content into CDS may use that content however it likes.

This is a plain reading by the maintainers, not legal advice. Check the current terms in NPR Studio.

## License

MIT for the files we wrote (`openapi.yaml`, `scripts/`, this README). The vendored JSON Schemas under `profiles/` and `schemas/` are NPR's and are reproduced as served, for interoperability.
