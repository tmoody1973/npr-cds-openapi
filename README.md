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
| `cortex.config.yml`, `cortex-templates/` | Cortex project and the one template override (auth header). |
| `mcp-server/` | Generated MCP server, published to npm as `npr-cds-mcp` (source committed; `dist/` and `node_modules/` are not). |
| `docs/` | Markdown context bundled into the docs site and the MCP server. |
| `scripts/test-mcp.mjs` | Smoke test that drives the MCP server over stdio against live CDS. |

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


## MCP server

`mcp-server/` is a Model Context Protocol server generated from the spec by [Cortex](https://github.com/cortex-docs/cortex). It gives Claude (or any MCP client) one tool per CDS operation plus the two docs pages above as context. Regenerate after changing the spec:

```bash
pnpm mcp          # bundle → cortex mcp generate → install → build
pnpm test:mcp     # smoke test against live CDS (needs NPR_CDS_TOKEN in the env)
```

**Auth.** Cortex's generated handlers send no authorization header, so `cortex-templates/mcp/handlers.ejs` is a sparse override that reads the token (environment variable first, then the file written by `setup`) and adds `Authorization: Bearer …` on the documents endpoints. `cortex-templates/mcp/main-stdio.ejs` adds the `setup` subcommand. Without a token, those tools return a readable message instead of a 401; the public profile and schema tools work regardless. The token is never written to disk by this project.

**Install for anyone, two lines.** The server is published to npm as `npr-cds-mcp`.

```bash
npx -y npr-cds-mcp setup                                 # asks for your CDS token once, saves it to ~/.config/npr-cds/token
claude mcp add npr-cds -s user -- npx -y npr-cds-mcp     # Claude Code
```

Claude Desktop or any JSON client:

```json
{ "mcpServers": { "npr-cds": { "command": "npx", "args": ["-y", "npr-cds-mcp"] } } }
```

`NPR_CDS_TOKEN` in the environment takes priority over the saved file, so CI or a shared machine can still pass the token as `-e NPR_CDS_TOKEN=…` on `claude mcp add`. Tokens are one per client under NPR's terms; each person should use their own.

Then ask things like "what are the three newest Ladies First episodes" or "show me the MP3 for g-s921-15973". List parameters (`collectionIds`, `profileIds`, `ids`…) are arrays; the server joins them with commas, which is CDS's OR syntax.

**Smart tools (hand-written, on top of the generated ones).** `mcp-server/src/smart/` adds three task-shaped tools, registered from `main.ts` so `pnpm mcp` cannot remove them. `find_stories` takes free text, a station name, a show or collection name, and a date window; it resolves names for you, matches words against title and teaser server-side, and returns compact hits (id, title, teaser, date, url, audio, collection names) newest first. `find_station` and `find_collection` expose the lookups on their own. Station names come from NPR's public directory; collection names are learned as ids pass through and cached under `~/.cache/npr-cds/` (or `$XDG_CACHE_HOME/npr-cds/`). Set `NPR_CDS_HOME_STATION` (e.g. `s921`) and hits from any other owner carry a `rights: display-only` note, per NPR's station terms. Why this shape: [docs/decisions/001-hybrid-smart-layer.md](docs/decisions/001-hybrid-smart-layer.md).

```sh
cd mcp-server && pnpm test        # unit tests for the smart layer (node:test, no network)
node scripts/bench-smart.mjs      # the two benchmark questions through the real server, live CDS
```

**Releasing a new version.** Bump `cdsMcpVersion` in `package.json`, run `pnpm mcp && pnpm test:mcp`, then `cd mcp-server && npm publish --access public`.

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
