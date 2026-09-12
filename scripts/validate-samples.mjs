// Validates real CDS responses against the vendored profile schemas.
// Usage: node scripts/validate-samples.mjs <response.json> [more.json ...]
// Each file is a CDS response ({ resources: [...] }) or a bare array of documents.
// Every document is checked against document + publishable + every vendored profile it lists;
// every entry in its assets bag is checked against document + its own profiles.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import Ajv2019 from "ajv/dist/2019.js";
import addFormats from "ajv-formats";
import { KINDS, ROOT, idFor } from "./lib.mjs";

// strict:false lets Ajv accept formats it does not know (NPR uses RFC 3987 "iri-reference");
// the quiet logger hides the per-format notice that would otherwise print on every run.
const ajv = new Ajv2019({ strict: false, logger: { log() {}, warn() {}, error: console.error } });
addFormats(ajv);

for (const kind of KINDS) {
  for (const file of await readdir(path.join(ROOT, kind))) {
    if (file.endsWith(".json") && file !== "index.json") ajv.addSchema(JSON.parse(await readFile(path.join(ROOT, kind, file), "utf8")));
  }
}
const vendored = new Set((await readdir(path.join(ROOT, "profiles"))).map((f) => f.replace(/\.json$/, "")));
const compiled = new Map();
const validatorFor = (names) => {
  const key = names.join("+");
  if (!compiled.has(key)) compiled.set(key, ajv.compile({ allOf: names.map((n) => ({ $ref: idFor("profiles", n) })) }));
  return compiled.get(key);
};
const profilesOf = (doc) => (doc.profiles ?? []).map((l) => l.href.replace("/v1/profiles/", "")).filter((n) => vendored.has(n));

let docs = 0, docFails = 0, assets = 0, assetFails = 0;
const failures = [];
for (const file of process.argv.slice(2)) {
  const json = JSON.parse(await readFile(file, "utf8"));
  for (const doc of Array.isArray(json) ? json : json.resources ?? []) {
    docs++;
    const names = [...new Set(["document", "publishable", ...profilesOf(doc)])];
    const check = validatorFor(names);
    if (!check(doc)) { docFails++; failures.push({ id: doc.id, profiles: names.join("+"), error: ajv.errorsText(check.errors) }); }
    for (const asset of Object.values(doc.assets ?? {})) {
      assets++;
      const an = [...new Set(["document", ...profilesOf(asset)])];
      const ac = validatorFor(an);
      if (!ac(asset)) { assetFails++; failures.push({ id: `${doc.id} › ${asset.id}`, profiles: an.join("+"), error: ajv.errorsText(ac.errors) }); }
    }
  }
}
console.log(`documents: ${docs - docFails}/${docs} valid · assets: ${assets - assetFails}/${assets} valid`);
for (const f of failures.slice(0, 15)) console.log(`  ✗ ${f.id} [${f.profiles}] ${f.error}`);
if (failures.length > 15) console.log(`  … ${failures.length - 15} more`);
process.exit(failures.length ? 1 : 0);
