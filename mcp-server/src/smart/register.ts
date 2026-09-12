import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { homedir } from 'node:os';
import path from 'node:path';
import { Catalog } from './catalog';
import { cdsQuery, fetchJson } from './cds';
import { findStories } from './find';

const cacheDir = path.join(process.env.XDG_CACHE_HOME || path.join(homedir(), '.cache'), 'npr-cds');
const text = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }], structuredContent: data as any });
const asError = (e: unknown) => ({ content: [{ type: 'text' as const, text: (e as Error).message }], isError: true });
export const safe = <A>(fn: (a: A) => Promise<unknown>) => async (a: A) => { try { return text(await fn(a)); } catch (e) { return asError(e); } };

// Task-shaped tools on top of the generated endpoint tools. Registered from main.ts so
// regenerating the server from the spec cannot remove them.
export function registerSmartTools(server: McpServer) {
  const catalog = new Catalog(fetchJson, cacheDir);
  const deps = { cdsQuery, catalog, homeStation: process.env.NPR_CDS_HOME_STATION };

  server.registerTool(
    'find_stories',
    { description: 'FIND CONTENT WITH THIS FIRST. Search CDS stories by free text, station name, show or collection name, and date window. Names are resolved for you (no ids needed). Returns compact hits newest first: id, title, teaser, date, url, audio, collection names. Free text is matched against title and teaser of the newest stories server-side and widened with matching collections. Use getDocument with a hit id when you need the full document.',
      inputSchema: {
      query: z.string().optional().describe('Free text, e.g. "AI", "Anthropic". Every word must appear in title or teaser.'),
      station: z.string().optional().describe('Station name, call letters, or city, e.g. "KCRW", "Radio Milwaukee", "Philadelphia".'),
      show: z.string().optional().describe('Show or series name, e.g. "Ladies First", "All Things Considered".'),
      collection: z.string().optional().describe('Topic, tag, or collection name, e.g. "Technology".'),
      since: z.string().optional().describe('YYYY-MM-DD'),
      until: z.string().optional().describe('YYYY-MM-DD'),
      limit: z.number().int().min(1).max(100).optional().describe('Hits to return. Default 10.'),
      scanPages: z.number().int().min(1).max(6).optional().describe('How many pages of 300 to scan for free text. Default 1.'),
      },
      annotations: { readOnlyHint: true },
    },
    safe((args) => findStories(args, deps)),
  );

  server.tool(
    'find_station',
    'Look up an NPR network station by name, call letters, or city. Returns service ids for ownerHrefs (e.g. KCRW -> s55).',
    { query: z.string() },
    safe(({ query }) => catalog.findStation(query)),
  );

  server.tool(
    'find_collection',
    'Look up a CDS collection (topic, tag, series, program) by name. Returns ids for collectionIds. Knows NPR topics and programs, plus every collection seen in earlier results.',
    { query: z.string() },
    safe(({ query }) => catalog.findCollection(query)),
  );
}
