import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

// Where `npr-cds-mcp setup` keeps things: the token (own file) and config.json with the home station.
export const CONFIG_DIR = path.join(homedir(), '.config', 'npr-cds');

export function readHomeStation(env: NodeJS.ProcessEnv = process.env, dir = CONFIG_DIR): string | undefined {
  if (env.NPR_CDS_HOME_STATION) return env.NPR_CDS_HOME_STATION;
  try { return JSON.parse(readFileSync(path.join(dir, 'config.json'), 'utf8')).homeStation || undefined; } catch { return undefined; }
}

const TOOL_HINTS = 'Words like story, episode, newscast, show, podcast mean NPR CDS content: use find_stories first (name the station for local content), then read_story. Use coverage_scan for "who in the network covered X" questions.';

// Sent to MCP clients at connect, so an assistant knows the smart tools exist before guessing at raw CDS calls.
export function smartInstructions(env: NodeJS.ProcessEnv = process.env, dir = CONFIG_DIR): string {
  const home = readHomeStation(env, dir);
  return home ? `Home station: ${home}. ${TOOL_HINTS}` : TOOL_HINTS;
}

export function saveHomeStation(id: string, dir = CONFIG_DIR) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700); // older versions created it with default permissions
  const file = path.join(dir, 'config.json');
  let current: Record<string, unknown> = {};
  try { current = JSON.parse(readFileSync(file, 'utf8')); } catch { /* first save */ }
  writeFileSync(file, JSON.stringify({ ...current, homeStation: id }, null, 2) + '\n', { mode: 0o600 });
  chmodSync(file, 0o600);
}
