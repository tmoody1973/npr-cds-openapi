# npr-cds-mcp

Ask NPR's Content Distribution Service (CDS) questions in plain words, from Claude or any MCP client. For NPR member stations. **Not affiliated with or endorsed by NPR.**

Source, docs, and the full guide for radio professionals: <https://github.com/tmoody1973/npr-cds-openapi>

## Setup

You need a CDS token from NPR Member Partnership and Node.js 20 or newer.

```bash
npx -y npr-cds-mcp setup                                 # saves your token to ~/.config/npr-cds/token
claude mcp add npr-cds -s user -e NPR_CDS_HOME_STATION=s921 -- npx -y npr-cds-mcp
```

Any MCP client, as JSON:

```json
{ "mcpServers": { "npr-cds": { "command": "npx", "args": ["-y", "npr-cds-mcp"], "env": { "NPR_CDS_HOME_STATION": "s921" } } } }
```

`NPR_CDS_TOKEN` in the environment takes priority over the saved file. `NPR_CDS_HOME_STATION` is your station's service id; with it set, other stations' content comes back marked display-only, per NPR's terms.

## What you can ask

- "What are the three newest Ladies First episodes?"
- "Latest NPR stories about AI"
- "Show me the newest KCRW stories"
- "Why isn't this story on our site?" (paste the url)
- "What labels does Radio Milwaukee actually use?"
- "What changed since yesterday?"
- "What's WXPN's station id?"

## Tools

| Tool | Give it | Get back |
|---|---|---|
| `find_stories` | words, a station, a show, a topic, a date window | compact hits newest first: title, teaser, date, link, audio, collection names |
| `check_story` | a story url or CDS id | in CDS or not, labels by name, audio, image, teaser, problems in plain language |
| `station_labels` | a station name | shows, programs, topics, tags, categories it uses, with counts |
| `whats_new_since` | a date or time, optionally a station | what was published or edited since, marked new or updated |
| `find_station` | a name, call letters, or city | station id |
| `find_collection` | a topic, tag, show, or program name | collection id |

Plus one generated tool per CDS endpoint (`queryDocuments`, `getDocument`, …) for the full document when you need it.

## Limits

CDS has no text search; word matching covers titles and teasers of the newest 300 to 1,800 stories per question, scoped to NPR unless you name a station. Names are learned as they pass through and cached under `~/.cache/npr-cds/`. Audio is always a link, never a download. Content from other stations may be displayed with attribution and refreshed, not stored.

MIT.
