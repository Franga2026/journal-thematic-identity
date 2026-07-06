/**
 * Servicio del frontend para el Descubridor bibliográfico universal.
 * Llama al proxy FastAPI (NO a OpenAlex directamente — la key vive en el servidor).
 *
 * DOS CAPAS DE CACHÉ:
 *   Capa 1 (aquí): caché de sesión en el navegador. Búsquedas repetidas del mismo
 *                  usuario son instantáneas y NO tocan el proxy.
 *   Capa 2 (proxy): caché compartido entre todos los usuarios (1h por defecto).
 *
 * Configura la URL base del proxy en .env.local del frontend:
 *   VITE_DISCOVERY_API_URL=http://localhost:8001
 */

const API_BASE =
  (import.meta as any).env?.VITE_DISCOVERY_API_URL || 'http://localhost:8001';

export interface WorkAuthor {
  name: string;
  orcid?: string | null;
}

export interface WorkResult {
  openalex_id: string;
  title: string;
  year?: number | null;
  doi?: string | null;
  type?: string | null;
  cited_by_count: number;
  fwci?: number | null;
  is_oa: boolean;
  oa_status?: string | null;
  oa_url?: string | null;
  journal?: string | null;
  authors: WorkAuthor[];
}

export interface SearchResponse {
  query: string;
  total: number;
  page: number;
  per_page: number;
  cost_usd: number;
  cached: boolean;
  results: WorkResult[];
}

export interface SearchParams {
  q: string;
  page?: number;
  perPage?: number;
  yearFrom?: number;
  yearTo?: number;
  openAccess?: boolean;
  sort?: 'relevance' | 'citations' | 'date';
}

export class DiscoveryError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'DiscoveryError';
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Capa 1: caché de sesión en el navegador (en memoria, se limpia al recargar)
// ---------------------------------------------------------------------------
const _sessionCache = new Map<string, SearchResponse>();

function cacheKey(p: SearchParams): string {
  return JSON.stringify([
    p.q.trim().toLowerCase(),
    p.page ?? 1,
    p.perPage ?? 25,
    p.yearFrom ?? null,
    p.yearTo ?? null,
    p.openAccess ?? null,
    p.sort ?? 'relevance',
  ]);
}

/** Limpia el caché de sesión del navegador (por si se quiere forzar recarga). */
export function clearSessionCache(): void {
  _sessionCache.clear();
}

/**
 * Busca obras en OpenAlex a través del proxy.
 * Revisa primero el caché de sesión (Capa 1); si no está, llama al proxy.
 * Lanza DiscoveryError con mensaje legible si algo falla.
 */
export async function searchWorks(params: SearchParams): Promise<SearchResponse> {
  const q = params.q?.trim();
  if (!q || q.length < 2) {
    throw new DiscoveryError('Ingresa al menos 2 caracteres para buscar.', 400);
  }

  // Capa 1: ¿ya la buscó este usuario en esta sesión?
  const key = cacheKey(params);
  const hit = _sessionCache.get(key);
  if (hit) {
    return { ...hit, cached: true };
  }

  const usp = new URLSearchParams();
  usp.set('q', q);
  if (params.page) usp.set('page', String(params.page));
  if (params.perPage) usp.set('per_page', String(params.perPage));
  if (params.yearFrom) usp.set('year_from', String(params.yearFrom));
  if (params.yearTo) usp.set('year_to', String(params.yearTo));
  if (params.openAccess !== undefined) usp.set('open_access', String(params.openAccess));
  if (params.sort) usp.set('sort', params.sort);

  const url = `${API_BASE}/search?${usp.toString()}`;

  let resp: Response;
  try {
    resp = await fetch(url, { method: 'GET' });
  } catch {
    throw new DiscoveryError(
      'No se pudo conectar con el servicio de búsqueda. ¿Está el proxy encendido?',
      0,
    );
  }

  if (!resp.ok) {
    let detail = `Error ${resp.status}`;
    try {
      const body = await resp.json();
      detail = body?.detail || detail;
    } catch {
      /* respuesta sin JSON */
    }
    if (resp.status === 429) {
      detail = 'Se alcanzó el límite de búsquedas. Intenta en un momento.';
    } else if (resp.status === 403) {
      detail = 'El servicio de búsqueda no está autorizado (revisa la API key).';
    }
    throw new DiscoveryError(detail, resp.status);
  }

  const data = (await resp.json()) as SearchResponse;

  // Guarda en la Capa 1 para repeticiones instantáneas en esta sesión
  _sessionCache.set(key, data);
  return data;
}

/** Consulta el saldo/uso restante en OpenAlex (para un panel de admin). */
export async function getUsage(): Promise<any> {
  const resp = await fetch(`${API_BASE}/usage`);
  if (!resp.ok) throw new DiscoveryError('No se pudo consultar el uso.', resp.status);
  return resp.json();
}

/** Enlaces útiles a partir de un resultado. */
export function workLinks(w: WorkResult) {
  return {
    doi: w.doi ? `https://doi.org/${w.doi}` : null,
    openalex: `https://openalex.org/${w.openalex_id}`,
    oa: w.oa_url || null,
  };
}

// ---------------------------------------------------------------------------
// Mapeo WorkResult (proxy) -> Work (portal), para renderizar con WorkCard.
// Usar con variant="openalex". Los campos siguen la forma compacta de Work.
// ---------------------------------------------------------------------------
export function workResultToWork(r: WorkResult): any {
  const doi = r.doi
    ? (r.doi.startsWith('http') ? r.doi : `https://doi.org/${r.doi}`)
    : undefined;
  return {
    t: r.title,
    y: r.year ?? undefined,
    c: r.cited_by_count ?? 0,
    s: r.journal ?? undefined,
    tp: r.type ?? undefined,
    oa: r.is_oa,
    ou: r.oa_url ?? undefined,
    d: doi,
    a: (r.authors || []).map((au) => au.name),
    fwci: r.fwci ?? undefined,
    impact: r.fwci ?? undefined,
    openalex_id: r.openalex_id,
  };
}
