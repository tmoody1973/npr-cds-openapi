import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { homedir } from 'node:os';
import path from 'node:path';
import { Catalog } from './catalog';
import { CDS, cdsQuery, fetchJson } from './cds';
import { readStory } from './reader';
import { coverageGap, coverageScan, searchArchive } from './coverage';
import { findStories } from './find';
import { networkPulse } from './pulse';
import { checkStory, latestNewscast, stationLabels, whatsNewSince } from './producer';
import { morningPrep, newsletterDraft, weeklyPrep, showPrep } from './prompts';
import { readHomeStation } from './config';

const cacheDir = path.join(process.env.XDG_CACHE_HOME || path.join(homedir(), '.cache'), 'npr-cds');
// MCP requires structuredContent to be an object; a few tools (find_station, find_collection)
// resolve to a plain array, so wrap it. `content` stays the raw JSON — that's what the assistant reads.
const text = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }], structuredContent: (Array.isArray(data) ? { results: data } : data) as any });
const asError = (e: unknown) => ({ content: [{ type: 'text' as const, text: (e as Error).message }], isError: true });
export const safe = <A>(fn: (a: A) => Promise<unknown>) => async (a: A) => { try { return text(await fn(a)); } catch (e) { return asError(e); } };

// Task-shaped tools on top of the generated endpoint tools. Registered from main.ts so
// regenerating the server from the spec cannot remove them.
export function registerSmartTools(server: McpServer) {
  const catalog = new Catalog(fetchJson, cacheDir);
  const deps = { cdsQuery, catalog, homeStation: readHomeStation(), cdsGet: (id: string) => fetchJson(`${CDS}/v1/documents/${encodeURIComponent(id)}`, { auth: true }) };

  server.registerTool(
    'find_stories',
    { description: 'FIND CONTENT WITH THIS FIRST. Search CDS stories, or podcast episodes with kind="podcasts", by free text, station name, show or podcast name, collection name, and date window. Names are resolved for you (no ids needed). Returns compact hits newest first: id, title, teaser, date, url, audio, collection names. Free text is matched against title and teaser of the newest stories server-side and widened with matching collections. Use getDocument with a hit id when you need the full document.',
      inputSchema: {
      query: z.string().optional().describe('Free text, e.g. "AI", "Anthropic". Every word must appear in title or teaser.'),
      station: z.string().optional().describe('Station name, call letters, or city, e.g. "KCRW", "Radio Milwaukee", "Philadelphia".'),
      show: z.string().optional().describe('Show or series name, e.g. "Ladies First", "All Things Considered".'),
      collection: z.string().optional().describe('Topic, tag, or collection name, e.g. "Technology".'),
      since: z.string().optional().describe('YYYY-MM-DD'),
      until: z.string().optional().describe('YYYY-MM-DD'),
      limit: z.number().int().min(1).max(100).optional().describe('Hits to return. Default 10.'),
      scanPages: z.number().int().min(1).max(6).optional().describe('How many pages of 300 to scan for free text. Default 1.'),
      kind: z.enum(['stories', 'podcasts']).optional().describe('"podcasts" searches podcast episodes (newscasts excluded) and resolves show to a podcast. Default stories.'),
      },
      annotations: { readOnlyHint: true },
    },
    safe((args) => findStories(args, deps)),
  );

  server.tool(
    'find_station',
    'Look up an NPR network station by name, call letters, or city. Returns service ids for ownerHrefs (e.g. KCRW -> s55), with city, state, band and whether it is music-only when NPR\'s station finder knows it.',
    { query: z.string() },
    // Directory entries carry only id and name; the finder fills in the rest, once per station.
    safe(async ({ query }) => {
      const out = [];
      for (const s of await catalog.findStation(query)) out.push(s.city ? s : await catalog.enrichStation(s.id)); // sequential: each enrichment rewrites the cache file
      return out;
    }),
  );

  server.tool(
    'find_collection',
    'Look up a CDS collection (topic, tag, series, program) by name. Returns ids for collectionIds. Knows NPR topics and programs, plus every collection seen in earlier results.',
    { query: z.string() },
    safe(({ query }) => catalog.findCollection(query)),
  );

  server.registerTool(
    'check_story',
    {
      description: 'Why is my story not showing up? Give a story url (npr.org or a station site) or a CDS id. Reports whether it is in CDS, its Show, topics, tags and categories by name, whether audio is attached, whether it has a primary image and teaser, and lists problems in plain language.',
      inputSchema: {
        url: z.string().optional().describe('The story\'s public url.'),
        id: z.string().optional().describe('CDS document id, e.g. g-s921-15973.'),
        station: z.string().optional().describe('Station the url belongs to, if not the home station.'),
      },
      annotations: { readOnlyHint: true },
    },
    safe((args) => checkStory(args, deps)),
  );

  server.registerTool(
    'station_labels',
    {
      description: 'What shows, podcasts, programs, topics, tags and categories a station actually uses, with counts, learned from its newest 300 stories and 300 podcast episodes. Use it to find the exact label names before filtering.',
      inputSchema: { station: z.string().optional().describe('Station name, call letters or city. Defaults to the home station.') },
      annotations: { readOnlyHint: true },
    },
    safe((args) => stationLabels(args, deps)),
  );

  server.registerTool(
    'whats_new_since',
    {
      description: 'Stories published or edited since a time, newest change first, each marked new or updated. Defaults to the home station, then NPR. Use for a morning check or an incremental sync.',
      inputSchema: {
        since: z.string().describe('YYYY-MM-DD or an ISO timestamp, e.g. 2026-09-12T08:00:00Z'),
        station: z.string().optional(),
        limit: z.number().int().min(1).max(300).optional().describe('Default 20.'),
      },
      annotations: { readOnlyHint: true },
    },
    safe((args) => whatsNewSince(args, deps)),
  );

  server.registerTool(
    'latest_newscast',
    {
      description: 'The newest newscast: NPR\'s hourly by default (long is about 5 minutes, short about 3), or a station\'s own. Returns publish time, length, and the stream link. NPR newscasts are premium audio: play or link, never store.',
      inputSchema: {
        length: z.enum(['long', 'short']).optional().describe('NPR cut. Default long.'),
        station: z.string().optional().describe('A station name for its own newscast. Default NPR.'),
      },
      annotations: { readOnlyHint: true },
    },
    safe((args) => latestNewscast(args, deps)),
  );

  const prompt = (text: string) => ({ messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] });
  server.registerPrompt(
    'morning-prep',
    {
      description: 'Morning show rundown: our new and updated stories, what NPR published, the newest newscast, and three talk breaks. Read-out-loud ready.',
      argsSchema: { since: z.string().optional().describe('YYYY-MM-DD or ISO time. Default yesterday 6am.'), station: z.string().optional() },
    },
    (args) => prompt(morningPrep(args)),
  );
  server.registerPrompt(
    'newsletter-draft',
    {
      description: 'Newsletter section from our stories and NPR\'s, every item linking back to its source, with audio links.',
      argsSchema: { topic: z.string().optional(), since: z.string().optional().describe('Default the last 7 days.'), station: z.string().optional() },
    },
    (args) => prompt(newsletterDraft(args, deps.homeStation)),
  );
  server.registerPrompt(
    'weekly-prep',
    {
      description: 'Weekly editorial prep: our week in review, what the network covered that we did not (coverage_gap on our top subjects), and NPR\'s week and newest podcasts for planning ahead.',
      argsSchema: { since: z.string().optional().describe('YYYY-MM-DD. Default seven days ago.'), station: z.string().optional() },
    },
    (args) => prompt(weeklyPrep(args, deps.homeStation)),
  );
  server.registerPrompt(
    'show-prep',
    {
      description: 'Prep for one show: its recent episodes, what the network and NPR said on its beat, and three questions for the host. Every item links to its source.',
      argsSchema: { show: z.string().describe('Show name, e.g. "Ladies First".'), since: z.string().optional().describe('YYYY-MM-DD. Default fourteen days ago.'), station: z.string().optional() },
    },
    (args) => prompt(showPrep(args, deps.homeStation)),
  );

  server.registerTool(
    'read_story',
    {
      description: 'READ THE TEXT of one story: its paragraphs in reading order with html removed, or its transcript when there is no written body, or a plain note when CDS holds only the teaser and audio. Give a story url (npr.org or a station site) or a CDS id. About half of NPR stories have body text in CDS; most of the rest get a transcript within hours.',
      inputSchema: {
        url: z.string().optional().describe('The story\'s public url.'),
        id: z.string().optional().describe('CDS document id.'),
        station: z.string().optional().describe('Station the url belongs to, if not the home station.'),
        maxChars: z.number().int().min(500).max(60000).optional().describe('Cap on returned text. Default 12000.'),
      },
      annotations: { readOnlyHint: true },
    },
    safe((args) => readStory(args, deps)),
  );

  const window = { since: z.string().describe('YYYY-MM-DD'), until: z.string().optional().describe('YYYY-MM-DD') };
  server.registerTool(
    'search_archive',
    {
      description: 'Dig through the archive for anniversary pieces, corrections and context. Walks back in half-year windows so each stays under CDS\'s cap, matching words in title and teaser. Newest first; stops at the limit, the from-date, or 12 windows (then tells you where to resume).',
      inputSchema: {
        query: z.string(), station: z.string().optional().describe('Default: home station.'), kind: z.enum(['stories', 'podcasts']).optional(),
        from: z.string().optional().describe('YYYY-MM-DD. Default 2010-01-01.'), to: z.string().optional().describe('YYYY-MM-DD. Default today.'),
        limit: z.number().int().min(1).max(100).optional().describe('Default 20.'), depth: z.number().int().min(1).max(6).optional().describe('Pages of 300 per window. Default 1.'),
      },
      annotations: { readOnlyHint: true },
    },
    safe((args) => searchArchive(args, deps)),
  );
  server.registerTool(
    'coverage_scan',
    {
      description: 'What the network published on a topic: NPR plus every station\'s newest stories in the window, grouped by station, or only the stations you name. For a news director planning a local angle.',
      inputSchema: { topic: z.string(), ...window, stations: z.array(z.string()).optional().describe('Station names to limit to.'), limit: z.number().int().min(1).max(50).optional().describe('Per station. Default 10.'), depth: z.number().int().min(1).max(6).optional().describe('Pages of 300 for the network scan. Default 1.') },
      annotations: { readOnlyHint: true },
    },
    safe((args) => coverageScan(args, deps)),
  );
  server.registerTool(
    'coverage_gap',
    {
      description: 'Editorial gaps: NPR\'s stories on a topic next to the home station\'s, each NPR story marked localized (a story of ours shares two or more meaningful title words) or not. A hint for a human to judge, not a verdict.',
      inputSchema: { topic: z.string(), ...window, limit: z.number().int().min(1).max(50).optional().describe('NPR stories to check. Default 20.') },
      annotations: { readOnlyHint: true },
    },
    safe((args) => coverageGap(args, deps)),
  );

  server.registerTool(
    'network_pulse',
    {
      description: 'The network\'s week in counts: which stations published, which shows and podcasts had new episodes, which topics ran, from one paged scan of the newest stories across every owner. Ids, names, counts, and last dates only, never text. For building an overview or an index; use find_stories to see the stories themselves.',
      inputSchema: {
        since: z.string().optional().describe('YYYY-MM-DD. Default seven days ago.'),
        until: z.string().optional().describe('YYYY-MM-DD'),
        depth: z.number().int().min(1).max(6).optional().describe('Pages of 300 newest stories to scan. Default 6.'),
        limit: z.number().int().min(1).max(200).optional().describe('Shows and topics to return, most active first. Default 60. Stations are never cut.'),
      },
      annotations: { readOnlyHint: true },
    },
    safe((args) => networkPulse(args, deps)),
  );
}
