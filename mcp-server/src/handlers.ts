import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

// hyfin override: token saved by `npr-cds-mcp setup`; read at call time, never cached or logged.
export function readSavedToken(): string | undefined {
  try { return readFileSync(path.join(homedir(), '.config', 'npr-cds', 'token'), 'utf8').trim() || undefined; }
  catch { return undefined; }
}

async function apiRequest(
  baseUrl: string,
  method: string,
  path: string,
  params: Record<string, unknown>,
  pathParams: string[],
  queryParams: string[],
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  let resolvedPath = path;
  for (const p of pathParams) {
    resolvedPath = resolvedPath.replace(`{${p}}`, String(params[p] ?? ''));
  }

  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = new URL(resolvedPath.replace(/^\/+/, ''), normalizedBaseUrl);
  for (const q of queryParams) {
    if (params[q] !== undefined) {
      url.searchParams.set(q, String(params[q]));
    }
  }

  const bodyParams = Object.fromEntries(
    Object.entries(params).filter(([k]) => !pathParams.includes(k) && !queryParams.includes(k)),
  );
  const hasBody = method !== 'GET' && method !== 'DELETE' && Object.keys(bodyParams).length > 0;

  // hyfin override: CDS needs a bearer token on the documents endpoints. Read it from the
  // environment at call time; never log it. Profile/schema endpoints are public and work without it.
  const token = process.env.NPR_CDS_TOKEN || readSavedToken();
  const needsToken = resolvedPath.startsWith('/v1/documents') || resolvedPath.startsWith('/v1/subscriptions');
  if (needsToken && !token) {
    return { content: [{ type: 'text', text: 'No CDS token found. Run `npx npr-cds-mcp setup` once, or set NPR_CDS_TOKEN in the MCP server environment, then retry.' }] };
  }
  const response = await fetch(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: hasBody ? JSON.stringify(bodyParams) : undefined,
  });

  const text = await response.text();

  if (!response.ok) {
    return { content: [{ type: 'text', text: `Error ${response.status}: ${text}` }] };
  }

  return { content: [{ type: 'text', text }] };
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    return { content: [{ type: 'text' as const, text: `Error ${response.status}: ${text}` }] };
  }
  return { content: [{ type: 'text' as const, text }] };
}



export async function handle_queryDocuments(
  params: Record<string, unknown>,
  baseUrl: string,
) {
  return apiRequest(baseUrl, 'GET', '/v1/documents', params, [], ['ids', 'excludedIds', 'profileIds', 'excludedProfileIds', 'collectionIds', 'ownerHrefs', 'excludedOwnerHrefs', 'nprWebsitePaths', 'publishDateTime', 'editorialLastModifiedDateTime', 'recommendUntilDateTime', 'showDates', 'seasonNumber', 'sort', 'limit', 'offset', 'transclude']);
}




export async function handle_getDocument(
  params: Record<string, unknown>,
  baseUrl: string,
) {
  return apiRequest(baseUrl, 'GET', '/v1/documents/{documentId}', params, ['documentId'], ['transclude']);
}




export async function handle_putDocument(
  params: Record<string, unknown>,
  baseUrl: string,
) {
  return apiRequest(baseUrl, 'PUT', '/v1/documents/{documentId}', params, ['documentId'], []);
}




export async function handle_deleteDocument(
  params: Record<string, unknown>,
  baseUrl: string,
) {
  return apiRequest(baseUrl, 'DELETE', '/v1/documents/{documentId}', params, ['documentId'], []);
}




export async function handle_listProfiles(
  params: Record<string, unknown>,
  baseUrl: string,
) {
  return apiRequest(baseUrl, 'GET', '/v1/profiles', params, [], []);
}




export async function handle_getProfile(
  params: Record<string, unknown>,
  baseUrl: string,
) {
  return apiRequest(baseUrl, 'GET', '/v1/profiles/{profileName}', params, ['profileName'], []);
}




export async function handle_getSchema(
  params: Record<string, unknown>,
  baseUrl: string,
) {
  return apiRequest(baseUrl, 'GET', '/v1/schemas/{schemaName}', params, ['schemaName'], []);
}




export async function handle_listClientProfiles(
  params: Record<string, unknown>,
  baseUrl: string,
) {
  return apiRequest(baseUrl, 'GET', '/v1/client-profiles', params, [], ['limit', 'offset']);
}




export async function handle_getClientProfile(
  params: Record<string, unknown>,
  baseUrl: string,
) {
  return apiRequest(baseUrl, 'GET', '/v1/client-profiles/{profileName}', params, ['profileName'], []);
}




export async function handle_confirmSubscription(
  params: Record<string, unknown>,
  baseUrl: string,
) {
  return apiRequest(baseUrl, 'POST', '/v1/subscriptions/confirmations', params, [], []);
}



