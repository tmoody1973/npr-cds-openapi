import { readSavedToken } from '../handlers';

export const CDS = 'https://content.api.npr.org';
export const NPR_SERVICE_ID = 's1';

// One JSON fetch. The token is read at call time and never logged or echoed.
export async function fetchJson(url: string, opts: { auth?: boolean } = {}): Promise<any> {
  const token = process.env.NPR_CDS_TOKEN || readSavedToken();
  if (opts.auth && !token) throw new Error('No CDS token found. Run `npx npr-cds-mcp setup` once, or set NPR_CDS_TOKEN.');
  const res = await fetch(url, { headers: opts.auth ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`CDS ${res.status} for ${new URL(url).pathname}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export const cdsQuery = (params: URLSearchParams) => fetchJson(`${CDS}/v1/documents?${params}`, { auth: true });
