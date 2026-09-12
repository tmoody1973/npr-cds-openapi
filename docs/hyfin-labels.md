# HYFIN content in CDS

HYFIN is Radio Milwaukee's urban-alternative station. Its stories are published through Brightspot into CDS under Radio Milwaukee's owner ID. CDS has no station-level "HYFIN" flag; HYFIN content is identified by the labels below.

## Identifiers

| What | Value | Notes |
|---|---|---|
| Owner (Radio Milwaukee, both 88Nine and HYFIN) | `https://organization.api.npr.org/v4/services/s921` | Too broad on its own. |
| Document ID prefix | `g-s921-` | Station-originated documents. |
| HYFIN tag | `g-s921-16131` | Created 2026-09-11. Apply to every HYFIN story going forward. |
| Ladies First (series) | `g-s921-13049` | HYFIN interview show. |
| In the Mix (series) | `g-s921-8151` | HYFIN. |
| La Alternativa (series) | `g-s921-3487` | HYFIN. |
| DJ Takeover (series) | `g-s921-1281` | Confirm with the editor. |
| Audio Taste Test (series) | `g-s921-15682` | Likely 88Nine. |
| What's All This (series) | `g-s921-4637` | Likely 88Nine. |

Series documents are referenced by stories but are not themselves published to CDS; fetching one returns 404. Their names come from each story's canonical URL (`/show/<slug>/`).

## Rules that shape any sync

From NPR's API Terms of Use for Stations (April 2025):

- A station's own content (owner s921 for us) may be stored and used freely.
- Other stations' or NPR's content may be stored only for display on a noncommercial member platform and must be refreshed regularly.
- Never store documents carrying `has-premium-audio`.
- Audio is served as links from NPR's side; never download MP3s.
- Keep `webPages[canonical]` for attribution on anything that is not ours.
- Handle withdrawals: a document that starts returning 404 must be removed.
