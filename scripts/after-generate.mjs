// Re-apply the hand-kept settings Cortex overwrites when it regenerates mcp-server/ from the spec.
// Cortex owns package.json and tsconfig.json there; the smart layer needs these three things in them.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";

const server = path.join(ROOT, "mcp-server");
const edit = (file, fn) => {
  const p = path.join(server, file);
  const json = JSON.parse(readFileSync(p, "utf8"));
  fn(json);
  writeFileSync(p, JSON.stringify(json, null, 2) + "\n");
};

edit("package.json", (pkg) => {
  pkg.dependencies = { ...pkg.dependencies, minisearch: "^7.2.0" };
  pkg.scripts = { ...pkg.scripts, test: 'node --import tsx --test "src/**/*.test.ts"' };
});
edit("tsconfig.json", (ts) => {
  ts.exclude = [...new Set([...(ts.exclude ?? []), "src/**/*.test.ts"])];
});
console.log("after-generate: minisearch dependency, test script, and test exclusion restored");
