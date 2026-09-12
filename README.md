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

`mcp-server/` is published to npm as **`npr-cds-mcp`** (current version 0.3.0). It is an MCP server, a small program that lets an AI assistant such as Claude use CDS as a tool. You type a question in plain English; the assistant picks a tool, the tool talks to CDS, and the answer comes back as a list a producer can read out loud.

### For radio professionals

**What you get.** An assistant that knows what's in CDS, yours and every other station's, and can answer by name. You never look up an id. You never read raw JSON.

**Setup, once, three lines.** You need a CDS token from NPR Member Partnership (one per person under NPR's terms) and Node.js 20 or newer.

```bash
npx -y npr-cds-mcp setup                                 # pastes your token into ~/.config/npr-cds/token, readable only by you
claude mcp add npr-cds -s user -e NPR_CDS_HOME_STATION=s921 -- npx -y npr-cds-mcp   # Claude Code; use your own station's id
```

Claude Desktop or any other MCP client takes the same thing as JSON:

```json
{ "mcpServers": { "npr-cds": { "command": "npx", "args": ["-y", "npr-cds-mcp"], "env": { "NPR_CDS_HOME_STATION": "s921" } } } }
```

`NPR_CDS_HOME_STATION` is your station's service id (Radio Milwaukee is `s921`; ask the assistant "what is KCRW's station id" and it will tell you). With it set, anything from another station comes back marked *display-only*, which is what NPR's terms require.

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

**Real situations.**

- *A digital editor gets a ticket: "my story isn't on the site."* Paste the url into `check_story`. Nine times out of ten the answer is a missing Show label or audio attached as a link instead of a file, and the tool says which.
- *A news director planning a local angle.* "What has NPR published on housing this week?" then "and KCRW?" Same question, different station name.
- *A producer's morning check.* "What changed since 8am?" shows what colleagues published or edited overnight.
- *A developer wiring a site to CDS.* `station_labels` gives the exact label names and ids to filter on, and `whats_new_since` is the call an incremental sync loop makes.

**The six tools**, for when you want to name one directly:

| Tool | Give it | Get back |
|---|---|---|
| `find_stories` | words, a station, a show, a topic, a date window, any mix | compact hits newest first: title, teaser, date, link, audio length and stream link, collection names |
| `check_story` | a story url or CDS id | in CDS or not, labels by name, audio, image, teaser, problems in plain language |
| `station_labels` | a station name | shows, programs, topics, tags, categories it uses, with counts |
| `whats_new_since` | a date or time, optionally a station | what was published or edited since, each marked new or updated |
| `find_station` | a name, call letters, or city | station id and name |
| `find_collection` | a topic, tag, show, or program name | its id |

The generated tools (`queryDocuments`, `getDocument`, and the rest, one per CDS endpoint) are still there for the full document when you need it.

**How it works, in order.** You ask for "Ladies First". The server looks the name up in a catalog it keeps (a lookup table, a list of names and ids it has seen before). If the name is missing, it reads your station's newest stories, notes which collections they point to, resolves the ones CDS will serve and infers the rest from the story urls, and remembers them for next time. It then asks CDS for that collection's stories, newest first. Before anything reaches the assistant it trims each 17 KB document down to the dozen fields a person needs, about 100 bytes. For a words question it also scans the newest 300 stories' titles and teasers itself and merges the two lists, so the assistant reads ten good hits instead of three hundred raw ones.

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
