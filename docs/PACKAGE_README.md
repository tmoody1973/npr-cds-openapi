# npr-cds-mcp

Ask NPR's Content Distribution Service (CDS) questions in plain words, from Claude or any MCP client. For NPR member stations. **Not affiliated with or endorsed by NPR.**

Source, docs, and the full guide for radio professionals: <https://github.com/tmoody1973/npr-cds-openapi>

## Setup

You need a CDS token from NPR Member Partnership and Node.js 20 or newer.

```bash
npx -y npr-cds-mcp setup                              # asks for your token, then "which station are you?"
claude mcp add npr-cds -s user -- npx -y npr-cds-mcp  # Claude Code
codex mcp add npr-cds -- npx -y npr-cds-mcp           # Codex: the CLI, the IDE extension, and the ChatGPT desktop app
```

**ChatGPT desktop app.** It shares Codex's MCP settings, so the `codex mcp add` line above is enough. Without a terminal: in the app, open Settings, then MCP servers, then Add server; choose STDIO, name it `npr-cds`, command `npx`, arguments `-y npr-cds-mcp`. Run `setup` once first either way; every client reads the same saved token and station.

**ChatGPT on the web (chatgpt.com) can't use it.** ChatGPT's web connectors reach only MCP servers hosted at a web address, and `npr-cds-mcp` runs on your own computer. Use the desktop app, Codex, or Claude.

Any MCP client, as JSON:

```json
{ "mcpServers": { "npr-cds": { "command": "npx", "args": ["-y", "npr-cds-mcp"] } } }
```

`setup` saves the token and your station under `~/.config/npr-cds/`, readable only by you. `npx -y npr-cds-mcp station` changes the station later. `NPR_CDS_TOKEN` and `NPR_CDS_HOME_STATION` in the environment override the saved files. With a station set, other stations' content comes back marked display-only, per NPR's terms.

More: [demo prompts for a newsroom](https://github.com/tmoody1973/npr-cds-openapi/blob/main/docs/DEMO-PROMPTS.md).

## What you can ask

- "What are the three newest Ladies First episodes?"
- "Latest NPR stories about AI"
- "Show me the newest KCRW stories"
- "Why isn't this story on our site?" (paste the url)
- "What labels does Radio Milwaukee actually use?"
- "What changed since yesterday?"
- "Newest This Bites episodes" (kind: podcasts)
- "NPR podcasts about AI" (each marked premium: play or link, never store)
- "Get me the latest NPR newscast"
- "/morning-prep" and "/newsletter-draft housing" (saved prompts)
- "What's WXPN's station id?"

## Try it

1. "What's my home station?" → your station, no id typed.
2. "Three newest Ladies First episodes" → titles, dates, lengths, links, one call.
3. "Latest NPR newscast" → the hourly cut with a play link and a never-store note.
4. "Why isn't this story on the site?" + a url → labels, audio, image, teaser, problems in plain words.
5. "What labels does our station use?" → shows, podcasts, topics, tags with counts.
6. "What changed since 8am?" → new and updated, newest change first.
7. "NPR podcasts about AI" → episodes marked premium: play or link, never store.
8. "Read me that story" + a url → the paragraphs, clean; or the transcript; or an honest note.
9. "What did NPR cover on AI this week that we haven't?" → gaps, flagged for a human to judge.
10. Run the `morning-prep` prompt → a read-out-loud rundown with talk breaks.

## Tools

| Tool | Give it | Get back |
|---|---|---|
| `find_stories` | words, a station, a show or podcast, a topic, a date window; `kind: podcasts` for episodes | compact hits newest first: title, teaser, date, link, audio, image (wide crop, resize template, credit), byline, collection names, rights note when premium or another station's |
| `read_story` | a story url or CDS id | paragraphs in reading order, or the transcript, or a note that CDS has only teaser and audio; plus image, byline, owner, teaser, and premium flag |
| `check_story` | a story url or CDS id | in CDS or not, labels by name, audio, image, teaser, problems in plain language |
| `station_labels` | a station name | shows, podcasts, programs, topics, tags, categories it uses, with counts |
| `whats_new_since` | a date or time, optionally a station | what was published or edited since, marked new or updated |
| `latest_newscast` | nothing, `short`, or a station | newest newscast: time, length, stream link; never-store note when premium |
| `search_archive` | words, a station, from and to dates | the archive in half-year windows, newest first |
| `coverage_scan` | a topic and a window | what NPR and the network published, by station |
| `coverage_gap` | a topic and a window | NPR's stories next to ours, marked localized or not |
| `network_pulse` | a date window | which stations, shows, and topics were active, as counts with ids and last dates; never text |
| `find_station` | a name, call letters, or city | station id, with city, state, band and music-only when the finder knows it |
| `find_collection` | a topic, tag, show, or program name | collection id |

Four saved prompts chain the tools into workflows: `morning-prep`, `weekly-prep` (the week in review, what the network covered that we did not, the week ahead), `show-prep` (one show's episodes, the network on its beat, three questions for the host), and `newsletter-draft`. Plus one generated tool per CDS endpoint (`queryDocuments`, `getDocument`, …) for the full document when you need it.

## Limits

CDS has no text search; word matching covers titles and teasers of the newest 300 to 1,800 stories per question, scoped to your home station and NPR unless you name a station. Names are learned as they pass through and cached under `~/.cache/npr-cds/`. Audio is always a link, never a download. Content from other stations may be displayed with attribution and refreshed, not stored.

MIT.
