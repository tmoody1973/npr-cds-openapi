# 001 — Keep the generated server, add a hand-written smart layer on top

**Decision.** The MCP server stays generated from the OpenAPI spec by Cortex (one tool per CDS endpoint), and gains a hand-written `smart/` module with task-shaped tools: `find_stories`, `find_station`, `find_collection`. The smart tools are registered from the entry file, which is a template override, so regenerating from the spec cannot remove them.

**Why this came up.** Finding content through the generated server was slow in the way that matters for an AI agent: not network time (CDS returns 300 stories in under a second) but round trips and bulk. Every tool returned the raw document (about 17 KB per story, of which about 100 bytes are useful), and Claude Code truncates any tool result over 25,000 tokens, so anything past five stories was cut off blind. CDS has no text search and no way to list collections, so "latest stories about AI" took five calls and 227,000 characters on 2026-09-12; "three newest Ladies First episodes" took one call only because the series id was already written down. Get this wrong and every question an editor asks costs minutes and money, or fails.

**Options.**
1. *Leave it generated, improve the docs tools.* Zero code. Cost: the model still has to know ids, still gets 17 KB per hit, still can't search by words. Nothing measured would change.
2. *Rewrite the server by hand.* Full control. Cost: lose the free parity with the spec; every CDS change becomes manual work, and the public repo stops being a spec-first project other stations can trust.
3. *Hybrid: generated endpoints plus a hand-written smart layer.* The spec still drives the raw tools; the smart tools do name lookup, server-side keyword matching, and return compact hits. Cost: the spec no longer describes everything the server does, and the smart layer needs its own tests and docs.

**What we chose and why.** Option 3, recommended by Claude, agreed by Tarik. Measured on the same two questions after the change: Ladies First, 1 call, 2,536 characters; AI stories, 1 call, 4,565 characters, and it found four Anthropic stories the collection-only query had missed. Names resolve through NPR's public station directory (686 services) and a learned collection catalog (a cache, a lookup table the server fills in as it sees ids), because station shows like Ladies First are not fetchable documents and can only be learned from the stories that point at them.

**What we gave up.** The keyword scan reads only titles and teasers, and only the newest 300 to 1,800 stories per filter, scoped to NPR unless a station is named. The learned catalog knows NPR's topics and programs on day one and everything else only after seeing it once, so the first query for a tag can miss what the second finds. Two files (the entry template and the handler template) now carry hand edits that must be kept in sync with their generated twins.

**How we'll know if this was right.**
- The two benchmark questions stay at one call each and under 5,000 characters (`node scripts/bench-smart.mjs`).
- An editor can ask for a show by name, a station by call letters or city, or a topic by words, without anyone supplying an id.
- Regenerating from the spec (`pnpm mcp`) leaves the smart tools in place and the unit tests green.

**What actually happened.**
_(Tarik fills this in.)_
