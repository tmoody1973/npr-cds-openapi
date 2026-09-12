# Querying NPR CDS

CDS is NPR's content API for member stations. Everything is a **document**: a JSON object that lists the **profiles** it implements (`story`, `audio`, `has-images`, `aggregation`…). Profiles add fields; the JSON Schema for each is public at `/v1/profiles/{name}`.

## Auth

Send `Authorization: Bearer <token>` on every documents request. The MCP server reads the token from the `NPR_CDS_TOKEN` environment variable and adds the header for you. Profile and schema endpoints need no token. Any valid token can read all of CDS; writes are limited to the client's own ID prefix.

## Filtering, in one breath

- Comma inside a parameter is **OR**: `profileIds=story,podcast-episode`.
- Repeating a parameter is **AND**: `profileIds=story&profileIds=has-audio`.
- Different parameters are **AND**. `excluded…` parameters remove matches.
- Dates take `2024-01-01`, `2024-01-01T00:00:00Z`, or ranges with `...`: `2024-01-01...`, `...2024-12-31`, `2024-01-01...2024-12-31`. A bare date is US Eastern.
- Paging: `limit` up to 300, and `offset + limit` never above 2000. No cursor.
- Always pass `sort` (usually `publishDateTime:desc`). NPR's docs call newest-first the default, but observed responses without `sort` came back oldest first. `sort=editorial` needs exactly one `collectionIds`.

## Reading a document

- `title`, `teaser`, `publishDateTime`, `editorialLastModifiedDateTime` at the top level.
- `collections[]` links say what the story belongs to; each has `rels` like `series`, `topic`, `tag`, `byline`.
- `audio[]`, `images[]`, `layout[]`, `bylines[]` hold links of the form `#/assets/<id>` into the document's own `assets` map.
- An **audio asset** has `enclosures[].href` (the MP3) and `duration` in seconds. An **image asset** has one enclosure per crop (`rels`: `image-wide`, `image-square`…) plus `hrefTemplate` for resizing. A **text asset** has `text` as HTML.

## Useful queries

- Stories by one station: `ownerHrefs=https://organization.api.npr.org/v4/services/<serviceId>&profileIds=story`
- One show: `collectionIds=<seriesId>&sort=publishDateTime:desc`
- Changed since a time, for sync: `editorialLastModifiedDateTime=2026-09-01T00:00:00Z...&sort=editorialLastModifiedDateTime:desc`
- One document with its collections resolved: `GET /v1/documents/{id}?transclude=collections`
