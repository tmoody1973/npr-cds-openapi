// Smoke test for the generated MCP server: starts it over stdio like an MCP client would,
// lists tools, and calls three of them against live CDS.
// Usage: NPR_CDS_TOKEN=... node scripts/test-mcp.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { ROOT } from "./lib.mjs";

const server = path.join(ROOT, "mcp-server");
const transport = new StdioClientTransport({
  command: "node",
  args: [path.join(server, "dist", "main.js")],
  env: { ...process.env },
});
const client = new Client({ name: "cds-mcp-smoke-test", version: "1.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log(`tools (${tools.length}): ${tools.map((t) => t.name).join(", ")}`);

const text = (r) => r.content?.map((c) => c.text ?? "").join("\n") ?? "";
const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  return text(r);
};

// Tool names are the OpenAPI operationIds.
const [queryTool, getTool, profilesTool] = ["queryDocuments", "getDocument", "listProfiles"];
for (const t of [queryTool, getTool, profilesTool]) if (!tools.some((x) => x.name === t)) throw new Error(`tool ${t} not registered`);

let failures = 0;
const check = (label, ok, detail) => { console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`); if (!ok) failures++; };

// 1. public endpoint, no token needed
const profiles = await call(profilesTool, {});
check("listProfiles returns the profile list", profiles.includes("/v1/profiles/story"), `${profiles.length} chars`);

// 2. query Ladies First
const q = await call(queryTool, { collectionIds: ["g-s921-13049"], profileIds: ["story"], limit: 3, sort: "publishDateTime:desc" });
let qj = null; try { qj = JSON.parse(q); } catch {}
const titles = qj?.resources?.map((d) => d.title) ?? [];
check("queryDocuments returns Ladies First stories", titles.length === 3 && titles.every((t) => /Ladies First/i.test(t)), titles.join(" | ") || q.slice(0, 160));

// 3. get one document and find its MP3
const id = qj?.resources?.[0]?.id;
const g = id ? await call(getTool, { documentId: id }) : "";
let gj = null; try { gj = JSON.parse(g); } catch {}
const doc = gj?.resources?.[0];
const audioKey = doc?.audio?.[0]?.href?.replace("#/assets/", "");
const mp3 = doc?.assets?.[audioKey]?.enclosures?.[0]?.href;
check("getDocument returns the story with a Dovetail MP3", typeof mp3 === "string" && mp3.includes("dovetail"), mp3 ?? g.slice(0, 160));

// 4. token never appears in tool output
const all = profiles + q + g;
check("token does not leak into output", !process.env.NPR_CDS_TOKEN || !all.includes(process.env.NPR_CDS_TOKEN));

await client.close();
process.exit(failures ? 1 : 0);
