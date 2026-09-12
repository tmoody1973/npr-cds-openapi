// Shared constants for the vendoring and validation scripts.
import path from "node:path";

export const BASE = "https://content.api.npr.org";
export const KINDS = ["schemas", "profiles"]; // folders under cds-spec/, mirroring /v1/<kind>/<name>
export const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
/** Canonical $id a vendored schema carries, so relative $refs resolve to sibling files. */
export const idFor = (kind, name) => `${BASE}/v1/${kind}/${name}.json`;
