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
  for (const h of j.hits) console.log(`${h.date}  ${h.title}  [${(h.collections ?? []).map((c) => c.name ?? c.id).slice(0, 3).join(", ")}]${h.audio ? `  ${Math.round(h.audio.seconds / 60)} min` : ""}${h.rights ? `  (${h.rights.includes("premium") ? "premium" : "display-only"})` : ""}`);
  if (tokens.some((t) => out.includes(t))) throw new Error("token leaked");
}
await bench("Ladies First, 3 newest (was 1 call, ~20K chars)", "find_stories", { show: "Ladies First", limit: 3 });
await bench("AI stories (was 5 calls, 227K chars)", "find_stories", { query: "AI", limit: 8 });
await bench("KCRW newest", "find_stories", { station: "KCRW", limit: 3 });

async function show(label, name, args, render) {
  const t0 = Date.now(); const out = text(await client.callTool({ name, arguments: args }));
  console.log(`\n== ${label} == 1 call, ${out.length} chars, ${Date.now() - t0} ms`); render(JSON.parse(out));
  if (tokens.some((t) => out.includes(t))) throw new Error("token leaked");
}
await show("check_story by station url", "check_story", { url: "https://radiomilwaukee.org/show/ladies-first/2026-09-04/blessing-jolie-20nothing-album" },
  (j) => console.log(`found=${j.found} show=${j.show} audio=${j.audio?.seconds ?? "none"}s image=${j.primaryImage} teaser=${j.teaser} problems=${JSON.stringify(j.problems)}`));
await show("station_labels Radio Milwaukee", "station_labels", { station: "Radio Milwaukee" },
  (j) => { console.log(`scanned ${j.scanned} stories, ${j.scannedPodcastEpisodes} podcast episodes`); for (const g of ["shows", "podcasts", "topics", "tags", "categories"]) console.log(`${g}: ${j[g].slice(0, 5).map((l) => `${l.name} (${l.count})`).join(", ")}`); });
await show("whats_new_since yesterday, home station", "whats_new_since", { since: new Date(Date.now() - 36e5 * 24).toISOString().slice(0, 10), limit: 5 },
  (j) => { console.log(`searched: ${j.searched}`); for (const h of j.hits) console.log(`${h.change.padEnd(7)} ${h.modified.slice(0, 16)}  ${h.title}`); });
await bench("This Bites podcast, newest 3", "find_stories", { show: "This Bites", kind: "podcasts", limit: 3 });
await bench("NPR podcasts about AI (premium note expected)", "find_stories", { query: "AI", kind: "podcasts", limit: 3 });
await show("read_story: Danielle Ponder (body)", "read_story", { id: "g-s921-16132" },
  (j) => console.log(`source=${j.source} words=${j.words} paragraphs=${j.paragraphs.length} first="${j.paragraphs[0]?.slice(0, 70)}…"`));
await show("read_story: NPR ATC segment (transcript)", "read_story", { id: "nx-s1-5964864" },
  (j) => console.log(`source=${j.source} words=${j.words} paragraphs=${j.paragraphs.length} first="${j.paragraphs[0]?.slice(0, 70)}…" rights=${j.rights ? "yes" : "none"}`));
await show("latest_newscast (NPR, long)", "latest_newscast", {},
  (j) => console.log(`${j.title} · ${Math.round(j.seconds / 60)} min · published ${j.published.slice(0, 16)} · ${j.rights ?? "no rights note"}`));
const { prompts } = await client.listPrompts();
console.log(`\n== prompts == ${prompts.map((p) => p.name).join(", ")}`);
const mp = await client.getPrompt({ name: "morning-prep", arguments: { since: "2026-09-11" } });
console.log(`morning-prep text: ${mp.messages[0].content.text.length} chars, mentions whats_new_since=${mp.messages[0].content.text.includes("whats_new_since")}`);
await client.close();
