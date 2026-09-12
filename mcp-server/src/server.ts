// @ts-nocheck — generated MCP server, runtime-validated by Zod
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {

  handle_queryDocuments,

  handle_getDocument,

  handle_putDocument,

  handle_deleteDocument,

  handle_listProfiles,

  handle_getProfile,

  handle_getSchema,

  handle_listClientProfiles,

  handle_getClientProfile,

  handle_confirmSubscription,

} from './handlers';

const BASE_URL = 'https://content.api.npr.org';

export function createServer(baseUrl: string = BASE_URL): McpServer {
  const server = new McpServer({
    name: 'npr-cds-mcp',
    version: '0.0.0',
  }, { instructions: "Read the project documentation and SDK reference tools before writing integration code. Prefer a generated SDK when one supports the user's language. Use direct API tools when no suitable SDK is available." });

  // --- API Spec Resources (readable by AI agents) ---

  server.resource(
    'openapi-spec',
    'api://specs/openapi',
    { description: 'OpenAPI specification — full REST API documentation', mimeType: 'text/yaml' },
    async () => ({
      contents: [{ uri: 'api://specs/openapi', text: fs.readFileSync(path.resolve(__dirname, '../specs/openapi.yaml'), 'utf-8'), mimeType: 'text/yaml' }],
    }),
  );


  // --- Tools ---

  server.tool(
    'docs_query_semantics_and_auth',
    'Read documentation: Query semantics and auth (Using CDS). Returns full markdown content.',
    {},
    async () => ({ content: [{ type: 'text' as const, text: "# Querying NPR CDS\n\nCDS is NPR's content API for member stations. Everything is a **document**: a JSON object that lists the **profiles** it implements (`story`, `audio`, `has-images`, `aggregation`…). Profiles add fields; the JSON Schema for each is public at `/v1/profiles/{name}`.\n\n## Auth\n\nSend `Authorization: Bearer <token>` on every documents request. The MCP server reads the token from the `NPR_CDS_TOKEN` environment variable and adds the header for you. Profile and schema endpoints need no token. Any valid token can read all of CDS; writes are limited to the client's own ID prefix.\n\n## Filtering, in one breath\n\n- Comma inside a parameter is **OR**: `profileIds=story,podcast-episode`.\n- Repeating a parameter is **AND**: `profileIds=story&profileIds=has-audio`.\n- Different parameters are **AND**. `excluded…` parameters remove matches.\n- Dates take `2024-01-01`, `2024-01-01T00:00:00Z`, or ranges with `...`: `2024-01-01...`, `...2024-12-31`, `2024-01-01...2024-12-31`. A bare date is US Eastern.\n- Paging: `limit` up to 300, and `offset + limit` never above 2000. No cursor.\n- Always pass `sort` (usually `publishDateTime:desc`). NPR's docs call newest-first the default, but observed responses without `sort` came back oldest first. `sort=editorial` needs exactly one `collectionIds`.\n\n## Reading a document\n\n- `title`, `teaser`, `publishDateTime`, `editorialLastModifiedDateTime` at the top level.\n- `collections[]` links say what the story belongs to; each has `rels` like `series`, `topic`, `tag`, `byline`.\n- `audio[]`, `images[]`, `layout[]`, `bylines[]` hold links of the form `#/assets/<id>` into the document's own `assets` map.\n- An **audio asset** has `enclosures[].href` (the MP3) and `duration` in seconds. An **image asset** has one enclosure per crop (`rels`: `image-wide`, `image-square`…) plus `hrefTemplate` for resizing. A **text asset** has `text` as HTML.\n\n## Useful queries\n\n- Stories by one station: `ownerHrefs=https://organization.api.npr.org/v4/services/<serviceId>&profileIds=story`\n- One show: `collectionIds=<seriesId>&sort=publishDateTime:desc`\n- Changed since a time, for sync: `editorialLastModifiedDateTime=2026-09-01T00:00:00Z...&sort=editorialLastModifiedDateTime:desc`\n- One document with its collections resolved: `GET /v1/documents/{id}?transclude=collections`\n" }] }),
  );


  server.tool(
    'docs_hyfin_labels_and_sync_rules',
    'Read documentation: HYFIN labels and sync rules (Using CDS). Returns full markdown content.',
    {},
    async () => ({ content: [{ type: 'text' as const, text: "# HYFIN content in CDS\n\nHYFIN is Radio Milwaukee's urban-alternative station. Its stories are published through Brightspot into CDS under Radio Milwaukee's owner ID. CDS has no station-level \"HYFIN\" flag; HYFIN content is identified by the labels below.\n\n## Identifiers\n\n| What | Value | Notes |\n|---|---|---|\n| Owner (Radio Milwaukee, both 88Nine and HYFIN) | `https://organization.api.npr.org/v4/services/s921` | Too broad on its own. |\n| Document ID prefix | `g-s921-` | Station-originated documents. |\n| HYFIN tag | `g-s921-16131` | Created 2026-09-11. Apply to every HYFIN story going forward. |\n| Ladies First (series) | `g-s921-13049` | HYFIN interview show. |\n| In the Mix (series) | `g-s921-8151` | HYFIN. |\n| La Alternativa (series) | `g-s921-3487` | HYFIN. |\n| DJ Takeover (series) | `g-s921-1281` | Confirm with the editor. |\n| Audio Taste Test (series) | `g-s921-15682` | Likely 88Nine. |\n| What's All This (series) | `g-s921-4637` | Likely 88Nine. |\n\nSeries documents are referenced by stories but are not themselves published to CDS; fetching one returns 404. Their names come from each story's canonical URL (`/show/<slug>/`).\n\n## Rules that shape any sync\n\nFrom NPR's API Terms of Use for Stations (April 2025):\n\n- A station's own content (owner s921 for us) may be stored and used freely.\n- Other stations' or NPR's content may be stored only for display on a noncommercial member platform and must be refreshed regularly.\n- Never store documents carrying `has-premium-audio`.\n- Audio is served as links from NPR's side; never download MP3s.\n- Keep `webPages[canonical]` for attribution on anything that is not ours.\n- Handle withdrawals: a document that starts returning 404 must be removed.\n" }] }),
  );


  server.tool(
    'intro_rest',
    'Read the CDS REST API introduction. Returns overview, base URL, rate limiting, and other essential context for the CDS REST API.',
    {},
    async () => ({ content: [{ type: 'text' as const, text: "# Querying NPR CDS\n\nCDS is NPR's content API for member stations. Everything is a **document**: a JSON object that lists the **profiles** it implements (`story`, `audio`, `has-images`, `aggregation`…). Profiles add fields; the JSON Schema for each is public at `/v1/profiles/{name}`.\n\n## Auth\n\nSend `Authorization: Bearer <token>` on every documents request. The MCP server reads the token from the `NPR_CDS_TOKEN` environment variable and adds the header for you. Profile and schema endpoints need no token. Any valid token can read all of CDS; writes are limited to the client's own ID prefix.\n\n## Filtering, in one breath\n\n- Comma inside a parameter is **OR**: `profileIds=story,podcast-episode`.\n- Repeating a parameter is **AND**: `profileIds=story&profileIds=has-audio`.\n- Different parameters are **AND**. `excluded…` parameters remove matches.\n- Dates take `2024-01-01`, `2024-01-01T00:00:00Z`, or ranges with `...`: `2024-01-01...`, `...2024-12-31`, `2024-01-01...2024-12-31`. A bare date is US Eastern.\n- Paging: `limit` up to 300, and `offset + limit` never above 2000. No cursor.\n- Always pass `sort` (usually `publishDateTime:desc`). NPR's docs call newest-first the default, but observed responses without `sort` came back oldest first. `sort=editorial` needs exactly one `collectionIds`.\n\n## Reading a document\n\n- `title`, `teaser`, `publishDateTime`, `editorialLastModifiedDateTime` at the top level.\n- `collections[]` links say what the story belongs to; each has `rels` like `series`, `topic`, `tag`, `byline`.\n- `audio[]`, `images[]`, `layout[]`, `bylines[]` hold links of the form `#/assets/<id>` into the document's own `assets` map.\n- An **audio asset** has `enclosures[].href` (the MP3) and `duration` in seconds. An **image asset** has one enclosure per crop (`rels`: `image-wide`, `image-square`…) plus `hrefTemplate` for resizing. A **text asset** has `text` as HTML.\n\n## Useful queries\n\n- Stories by one station: `ownerHrefs=https://organization.api.npr.org/v4/services/<serviceId>&profileIds=story`\n- One show: `collectionIds=<seriesId>&sort=publishDateTime:desc`\n- Changed since a time, for sync: `editorialLastModifiedDateTime=2026-09-01T00:00:00Z...&sort=editorialLastModifiedDateTime:desc`\n- One document with its collections resolved: `GET /v1/documents/{id}?transclude=collections`\n" }] }),
  );



  server.tool(
    'queryDocuments',
    'Query documents',
    {

      ids: z.array(z.unknown()).optional().describe('Only documents whose ID is in this list.'),

      excludedIds: z.array(z.unknown()).optional().describe('Documents whose ID is in this list are removed from the result.'),

      profileIds: z.array(z.unknown()).optional().describe('Only documents that list one of these profiles at the top level. Repeat the parameter to require several.'),

      excludedProfileIds: z.array(z.unknown()).optional().describe('Documents listing any of these profiles at the top level are removed.'),

      collectionIds: z.array(z.unknown()).optional().describe('Only documents belonging to one of these collections, whether the membership is unordered (the document links to the collection) or ordered (the collection\'s `items` lists the document). Use exactly one ID here when sorting with `sort=editorial`. '),

      ownerHrefs: z.array(z.unknown()).optional().describe('Only documents whose `owners` array contains one of these Organization Service URIs. This is how to scope a query to one station. '),

      excludedOwnerHrefs: z.array(z.unknown()).optional().describe('Documents owned by any of these services are removed.'),

      nprWebsitePaths: z.array(z.unknown()).optional().describe('Only documents whose `nprWebsitePaths` contains one of these npr.org paths.'),

      publishDateTime: z.string().optional().describe('Date or date range on `publishDateTime`. See the date syntax in the API description.'),

      editorialLastModifiedDateTime: z.string().optional().describe('Date or date range on `editorialLastModifiedDateTime`. Useful for incremental sync.'),

      recommendUntilDateTime: z.string().optional().describe('Date or date range on `recommendUntilDateTime`.'),

      showDates: z.string().optional().describe('The full-date subset of `DateOrRange` (no time part), matched against entries in `showDates`.'),

      seasonNumber: z.number().optional().describe('Single season number; meaningful with `profileIds=podcast-episode`.'),

      sort: z.string().optional().describe('`<field>[:<direction>[:<missing>]]`, comma-separated for multi-field sort, evaluated left to right. Fields: `publishDateTime`, `editorialLastModifiedDateTime`, `showDates`, `seasonNumber`, `episodeNumber`, and `editorial` (no direction; requires exactly one `collectionIds` value; ordered items first, then the rest by `publishDateTime`). Direction is `asc` or `desc`, default `desc`. `missing` is `first` or `last` and places documents lacking the field, independent of direction. '),

      limit: z.number().optional().describe('Documents per page. `offset + limit` must not exceed 2000.'),

      offset: z.number().optional().describe('Zero-based start position. `offset + limit` must not exceed 2000.'),

      transclude: z.array(z.unknown()).optional().describe('Pre-fetch linked documents into an `embed` field on the matching link objects. Known limits documented by NPR (Feb 2024): `bylines` only resolves text bylines, and `transcript` does not work as expected. '),

    },
    async (params: any) => handle_queryDocuments(params, baseUrl),
  );


  server.tool(
    'getDocument',
    'Get one document',
    {

      documentId: z.string().describe('Document ID. Numeric for NPR-originated documents, prefixed for station documents.'),

      transclude: z.array(z.unknown()).optional().describe('Pre-fetch linked documents into an `embed` field on the matching link objects. Known limits documented by NPR (Feb 2024): `bylines` only resolves text bylines, and `transcript` does not work as expected. '),

    },
    async (params: any) => handle_getDocument(params, baseUrl),
  );


  server.tool(
    'putDocument',
    'Create or update a document',
    {

      documentId: z.string().describe('Document ID. Numeric for NPR-originated documents, prefixed for station documents.'),

      body: z.object({}).describe('Request body'),

    },
    async (params: any) => handle_putDocument(params, baseUrl),
  );


  server.tool(
    'deleteDocument',
    'Delete a document',
    {

      documentId: z.string().describe('Document ID. Numeric for NPR-originated documents, prefixed for station documents.'),

    },
    async (params: any) => handle_deleteDocument(params, baseUrl),
  );


  server.tool(
    'listProfiles',
    'List all profiles',
    {

    },
    async (params: any) => handle_listProfiles(params, baseUrl),
  );


  server.tool(
    'getProfile',
    'Get one profile\'s JSON Schema',
    {

      profileName: z.string().describe('Profile name, for example `story`, `audio`, `has-images`. See `GET /v1/profiles` for the full list.'),

    },
    async (params: any) => handle_getProfile(params, baseUrl),
  );


  server.tool(
    'getSchema',
    'Get a shared JSON Schema',
    {

      schemaName: z.string().describe('A CDS profile or schema name, for example `story` or `link`. The authoritative profile list is `GET /v1/profiles`.'),

    },
    async (params: any) => handle_getSchema(params, baseUrl),
  );


  server.tool(
    'listClientProfiles',
    'List client profiles',
    {

      limit: z.number().optional().describe('Documents per page. `offset + limit` must not exceed 2000.'),

      offset: z.number().optional().describe('Zero-based start position. `offset + limit` must not exceed 2000.'),

    },
    async (params: any) => handle_listClientProfiles(params, baseUrl),
  );


  server.tool(
    'getClientProfile',
    'Get one client profile',
    {

      profileName: z.string(),

    },
    async (params: any) => handle_getClientProfile(params, baseUrl),
  );


  server.tool(
    'confirmSubscription',
    'Confirm a notification subscription',
    {

      Type: z.string().optional(),

    },
    async (params: any) => handle_confirmSubscription(params, baseUrl),
  );


  return server;
}
