// Benchmark the two questions from 2026-09-12 through the real server over stdio.
// Usage: node scripts/bench-smart.mjs   (needs a CDS token via env or `npr-cds-mcp setup`)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { ROOT } from "./lib.mjs";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

// Every token the server could be using, so a leak fails the benchmark whichever source is configured.
const tokens = [process.env.NPR_CDS_TOKEN, (() => { try { return readFileSync(path.join(homedir(), ".config", "npr-cds", "token"), "utf8").trim(); } catch { return ""; } })()].filter(Boolean);

const transport = new StdioClientTransport({ command: "node", args: [path.join(ROOT, "mcp-server", "dist", "main.js")], env: { ...process.env } });
const client = new Client({ name: "bench", version: "1.0.0" });
await client.connect(transport);
const text = (r) => r.content?.map((c) => c.text ?? "").join("\n") ?? "";

async function bench(label, name, args) {
  const t0 = Date.now();
  const r = await client.callTool({ name, arguments: args });
  const out = text(r);
  const j = JSON.parse(out);
  console.log(`\n== ${label} == 1 call, ${out.length} chars, ${Date.now() - t0} ms`);
  console.log(`searched: ${j.searched}`);
  for (const h of j.hits) console.log(`${h.date}  ${h.title}  [${(h.collections ?? []).map((c) => c.name ?? c.id).slice(0, 3).join(", ")}]${h.audio ? `  ${Math.round(h.audio.seconds / 60)} min` : ""}${h.rights ? "  (display-only)" : ""}`);
  if (tokens.some((t) => out.includes(t))) throw new Error("token leaked");
}
await bench("Ladies First, 3 newest (was 1 call, ~20K chars)", "find_stories", { show: "Ladies First", limit: 3 });
await bench("AI stories (was 5 calls, 227K chars)", "find_stories", { query: "AI", limit: 8 });
await bench("KCRW newest", "find_stories", { station: "KCRW", limit: 3 });
await client.close();
