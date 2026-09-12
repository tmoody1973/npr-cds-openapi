import { readSavedToken } from '../handlers';

export const CDS = 'https://content.api.npr.org';
const TIMEOUT_MS = 30_000;
export const NPR_SERVICE_ID = 's1';

// One JSON fetch. The token is read at call time and never logged or echoed.
export async function fetchJson(url: string, opts: { auth?: boolean } = {}): Promise<any> {
  const token = process.env.NPR_CDS_TOKEN || readSavedToken();
  if (opts.auth && !token) throw new Error('No CDS token found. Run `npx npr-cds-mcp setup` once, or set NPR_CDS_TOKEN.');
  const pathname = new URL(url).pathname;
  try {
    const res = await fetch(url, { headers: opts.auth ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`CDS ${res.status} for ${pathname}: ${(await res.text()).slice(0, 200)}`);
    return await res.json();
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') throw new Error(`CDS did not answer ${pathname} within ${TIMEOUT_MS / 1000}s.`);
    throw e;
  }
}

export const cdsQuery = (params: URLSearchParams) => fetchJson(`${CDS}/v1/documents?${params}`, { auth: true });
