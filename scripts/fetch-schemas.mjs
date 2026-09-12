// Vendors NPR CDS's public JSON Schemas so openapi.yaml can reference them offline.
// No token needed: /v1/profiles and /v1/schemas are open access.
// Rewrites absolute "$ref": "/v1/schemas/x" and "/v1/profiles/x" to relative file refs,
// stamps a full-URL $id, and normalizes the $schema marker (NPR's carries a trailing '#').
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BASE, KINDS, ROOT, idFor } from "./lib.mjs";

const REF_RE = new RegExp(`^/v1/(${KINDS.join("|")})/([A-Za-z0-9._-]+)$`);
const parseRef = (ref) => { const m = ref.match(REF_RE); return m && { kind: m[1], name: m[2] }; };

function rewriteRefs(node, fromKind, found) {
  if (Array.isArray(node)) return node.map((n) => rewriteRefs(n, fromKind, found));
  if (!node || typeof node !== "object") return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    const [base, frag = ""] = k === "$ref" && typeof v === "string" ? v.split("#") : [];
    const loc = base && parseRef(base);
    if (loc) {
      found.add(base);
      out[k] = (fromKind === loc.kind ? `./${loc.name}.json` : `../${loc.kind}/${loc.name}.json`) + (frag ? `#${frag}` : "");
    } else {
      out[k] = rewriteRefs(v, fromKind, found);
    }
  }
  return out;
}

async function vendor(ref) {
  const { kind, name } = parseRef(ref);
  const res = await fetch(BASE + ref);
  if (!res.ok) { console.error(`  ${ref} -> HTTP ${res.status}`); return []; }
  const found = new Set();
  const schema = rewriteRefs(await res.json(), kind, found);
  schema.$id = idFor(kind, name);
  if (typeof schema.$schema === "string") schema.$schema = schema.$schema.replace(/#$/, "");
  await writeFile(path.join(ROOT, kind, `${name}.json`), JSON.stringify(schema, null, 2) + "\n");
  return [...found];
}

await Promise.all(KINDS.map((k) => mkdir(path.join(ROOT, k), { recursive: true })));
const index = await (await fetch(`${BASE}/v1/profiles`)).json();
const seen = new Set();
let wave = [...index.map((l) => l.href), "/v1/schemas/link"];
while (wave.length) {
  wave = wave.filter((r) => !seen.has(r) && seen.add(r));
  const discovered = await Promise.all(wave.map(vendor)); // fetch each wave in parallel
  wave = discovered.flat();
}
await writeFile(path.join(ROOT, "profiles", "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(`vendored ${seen.size} schema documents (${index.length} profiles) from ${BASE}`);
