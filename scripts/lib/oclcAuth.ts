/**
 * OCLC OAuth2 client-credentials — server-side only.
 * @see https://www.oclc.org/developer/develop/authentication/access-tokens/client-credentials-grant.en.html
 */

const REQUIRED_ENV = [
  'OCLC_WSKEY_CLIENT_ID',
  'OCLC_WSKEY_SECRET',
  'OCLC_TOKEN_URL',
] as const;

const EXPIRY_BUFFER_MS = 60_000;

interface TokenCacheEntry {
  accessToken: string;
  expiresAtMs: number;
  contextInstitutionId?: string;
  scopes?: string;
}

interface OclcTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: string | number;
  scopes?: string;
  contextInstitutionId?: string;
}

export interface OclcTokenResult {
  /** Bearer token — no registrar ni enviar al cliente */
  accessToken: string;
  /** Segundos hasta expiración (de expires_in o tiempo restante en caché) */
  expiresInSec: number;
  /** Registry ID de la institución asociada al token (si la respuesta OAuth lo incluye) */
  contextInstitutionId?: string;
  /** Scopes concedidos (si la respuesta OAuth los incluye) */
  scopes?: string;
}

const cacheByScope = new Map<string, TokenCacheEntry>();

function requireEnv(): {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
} {
  const missing: string[] = [];
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]?.trim()) missing.push(key);
  }
  if (missing.length > 0) {
    throw new Error(
      `OCLC auth: faltan variables de entorno: ${missing.join(', ')}. ` +
        'Defínalas en .env (ver .env.example).'
    );
  }
  return {
    clientId: process.env.OCLC_WSKEY_CLIENT_ID!.trim(),
    clientSecret: process.env.OCLC_WSKEY_SECRET!.trim(),
    tokenUrl: process.env.OCLC_TOKEN_URL!.trim(),
  };
}

function normalizeScope(scope: string): string {
  const normalized = scope.trim();
  if (!normalized) {
    throw new Error('OCLC auth: scope requerido (copie el valor exacto del portal WSKey).');
  }
  return normalized;
}

function parseExpiresIn(raw: string | number | undefined): number {
  if (raw == null || raw === '') return 3600;
  const sec = Number(raw);
  if (!Number.isFinite(sec) || sec <= 0) {
    throw new Error('OCLC auth: expires_in inválido en la respuesta del servidor');
  }
  return sec;
}

async function requestNewToken(scope: string): Promise<OclcTokenResult> {
  const { clientId, clientSecret, tokenUrl } = requireEnv();

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    scope,
  });
  const url = `${tokenUrl}?${params.toString()}`;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${basicAuth}`,
    },
  });

  if (!res.ok) {
    throw new Error(
      `OCLC auth: solicitud de token fallida (${res.status} ${res.statusText}). ` +
        'Revise WSKey, secret, scope y OCLC_TOKEN_URL.'
    );
  }

  const data = (await res.json()) as OclcTokenResponse;
  if (!data.access_token?.trim()) {
    throw new Error('OCLC auth: la respuesta no incluye access_token');
  }

  const expiresInSec = parseExpiresIn(data.expires_in);
  return {
    accessToken: data.access_token.trim(),
    expiresInSec,
    contextInstitutionId: data.contextInstitutionId?.trim() || undefined,
    scopes: data.scopes?.trim() || undefined,
  };
}

function remainingSec(expiresAtMs: number): number {
  return Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
}

/** Obtiene un access token Bearer válido para el scope indicado (caché por scope). */
export async function getToken(scope: string): Promise<string> {
  const { accessToken } = await getTokenResult(scope);
  return accessToken;
}

/** Token + TTL; usar en scripts de prueba sin imprimir accessToken. */
export async function getTokenResult(scope: string): Promise<OclcTokenResult> {
  const normalizedScope = normalizeScope(scope);
  const now = Date.now();
  const cached = cacheByScope.get(normalizedScope);

  if (cached && cached.expiresAtMs - EXPIRY_BUFFER_MS > now) {
    return {
      accessToken: cached.accessToken,
      expiresInSec: remainingSec(cached.expiresAtMs),
      contextInstitutionId: cached.contextInstitutionId,
      scopes: cached.scopes,
    };
  }

  const result = await requestNewToken(normalizedScope);
  cacheByScope.set(normalizedScope, {
    accessToken: result.accessToken,
    expiresAtMs: now + result.expiresInSec * 1000,
    contextInstitutionId: result.contextInstitutionId,
    scopes: result.scopes,
  });
  return result;
}

/** Solo tests — invalida caché (un scope o toda). */
export function clearOclcTokenCache(scope?: string): void {
  if (scope === undefined) {
    cacheByScope.clear();
    return;
  }
  cacheByScope.delete(normalizeScope(scope));
}
