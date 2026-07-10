/**
 * Servicio del frontend para el Descubridor bibliográfico universal.
 * Llama al proxy FastAPI en el puerto 8002 (NO 8001 — ese es el Catalogador IA).
 *
 * DOS CAPAS DE CACHÉ:
 *   Capa 1 (aquí): caché de sesión en el navegador.
 *   Capa 2 (proxy): caché compartido entre usuarios.
 *
 * CAPA A: facetas (getFacets), filtros ampliados (tipo, oa_status, área,
 * editorial, fwci_min), campos nuevos (abstract, editorial, área, ISSN).
 * CAPA B: cuartil SJR (Scimago) vía mapa ISSN en el proxy.
 */

const API_BASE =
  (import.meta as any).env?.VITE_DISCOVERY_API_URL || 'http://localhost:8002';

export interface WorkAuthor {
  name: string;
  orcid?: string | null;
  author_id?: string | null;   // OpenAlex Author ID (A…) — para match UTA
  position?: string | null;     // "first" | "middle" | "last"
}

export interface LinkedDataset {
  openalex_id: string;
  title: string;
  doi?: string | null;
  url?: string | null;
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
  pdf_url?: string | null;
  best_oa_repo?: string | null;
  journal?: string | null;
  publisher?: string | null;
  field?: string | null;
  issn_l?: string | null;
  quartile?: string | null;
  abstract?: string | null;
  authors: WorkAuthor[];
  linked_datasets?: LinkedDataset[];
  linked_datasets_count?: number;
  source_type?: string | null;
  is_journal_article?: boolean;
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

export type SortMode = 'relevance' | 'citations' | 'date' | 'date_asc';

export interface SearchParams {
  q?: string;
  authorId?: string;
  page?: number;
  perPage?: number;
  yearFrom?: number;
  yearTo?: number;
  openAccess?: boolean;
  type?: string;          // 'article' | 'book' | 'dataset' | ... (o lista con |)
  oaStatus?: string;      // 'gold' | 'green' | 'hybrid' | 'bronze' | 'closed'
  field?: string;         // id de área temática de OpenAlex
  publisher?: string;     // id host_organization (P… editorial)
  repository?: string;    // id host_organization (I… repositorio/institución)
  datasetRepository?: string; // id host_organization para datasets
  fwciMin?: number;       // filtro FWCI > N
  quartile?: string;      // 'Q1' | 'Q2' | 'Q3' | 'Q4' (SJR/Scimago)
  sort?: SortMode;
}

export interface FacetBucket {
  key: string;
  label: string;
  count: number;
}

export interface FacetsResponse {
  query: string;
  cached: boolean;
  cost_usd: number;
  types: FacetBucket[];
  oa_status: FacetBucket[];
  fields: FacetBucket[];
  publishers: FacetBucket[];
  repositories: FacetBucket[];
  dataset_repositories: FacetBucket[];
  quartiles: FacetBucket[];
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
// Capa 1: caché de sesión
// ---------------------------------------------------------------------------
const _sessionCache = new Map<string, SearchResponse>();
const _facetsCache = new Map<string, FacetsResponse>();

function cacheKey(p: SearchParams): string {
  const q = p.q?.trim().toLowerCase() ?? '';
  const authorId = p.authorId?.trim() ?? '';
  return JSON.stringify([
    q, authorId, p.page ?? 1, p.perPage ?? 25,
    p.yearFrom ?? null, p.yearTo ?? null, p.openAccess ?? null,
    p.type ?? null, p.oaStatus ?? null, p.field ?? null,
    p.publisher ?? null, p.repository ?? null, p.datasetRepository ?? null,
    p.fwciMin ?? null, p.quartile ?? null, p.sort ?? 'relevance',
  ]);
}

export function clearSessionCache(): void {
  _sessionCache.clear();
  _facetsCache.clear();
}

// ---------------------------------------------------------------------------
// Búsqueda principal
// ---------------------------------------------------------------------------
export async function searchWorks(params: SearchParams): Promise<SearchResponse> {
  const q = params.q?.trim() ?? '';
  const authorId = params.authorId?.trim().replace(/^https?:\/\/openalex\.org\//i, '') ?? '';
  if (q.length < 2 && !authorId) {
    throw new DiscoveryError("Se requiere 'q' o 'author_id'.", 400);
  }

  const key = cacheKey(params);
  const hit = _sessionCache.get(key);
  if (hit) return { ...hit, cached: true };

  const usp = new URLSearchParams();
  if (q.length >= 2) usp.set('q', q);
  if (authorId) usp.set('author_id', authorId);
  if (params.page) usp.set('page', String(params.page));
  if (params.perPage) usp.set('per_page', String(params.perPage));
  if (params.yearFrom) usp.set('year_from', String(params.yearFrom));
  if (params.yearTo) usp.set('year_to', String(params.yearTo));
  if (params.openAccess !== undefined) usp.set('open_access', String(params.openAccess));
  if (params.type) usp.set('type', params.type);
  if (params.oaStatus) usp.set('oa_status', params.oaStatus);
  if (params.field) usp.set('field', params.field);
  if (params.publisher) usp.set('publisher', params.publisher);
  if (params.repository) usp.set('repository', params.repository);
  if (params.datasetRepository) usp.set('dataset_repository', params.datasetRepository);
  if (params.fwciMin) usp.set('fwci_min', String(params.fwciMin));
  if (params.quartile) usp.set('quartile', params.quartile);
  if (params.sort) usp.set('sort', params.sort);

  const url = `${API_BASE}/search?${usp.toString()}`;

  let resp: Response;
  try {
    resp = await fetch(url, { method: 'GET' });
  } catch {
    throw new DiscoveryError(
      'No se pudo conectar con el servicio de búsqueda. ¿Está el proxy encendido (8002)?',
      0,
    );
  }

  if (!resp.ok) {
    let detail = `Error ${resp.status}`;
    try {
      const body = await resp.json();
      detail = body?.detail || detail;
    } catch { /* sin JSON */ }
    if (resp.status === 429) detail = 'Se alcanzó el límite de búsquedas. Intenta en un momento.';
    else if (resp.status === 403) detail = 'El servicio de búsqueda no está autorizado (API key).';
    throw new DiscoveryError(detail, resp.status);
  }

  const data = (await resp.json()) as SearchResponse;
  _sessionCache.set(key, data);
  return data;
}

// ---------------------------------------------------------------------------
// Facetas (conteos)
// ---------------------------------------------------------------------------
export async function getFacets(
  q: string,
  opts: { yearFrom?: number; yearTo?: number } = {},
): Promise<FacetsResponse> {
  const query = q?.trim();
  if (!query || query.length < 2) {
    throw new DiscoveryError('Consulta demasiado corta para facetas.', 400);
  }

  const key = JSON.stringify([query.toLowerCase(), opts.yearFrom ?? null, opts.yearTo ?? null]);
  const hit = _facetsCache.get(key);
  if (hit) return { ...hit, cached: true };

  const usp = new URLSearchParams();
  usp.set('q', query);
  if (opts.yearFrom) usp.set('year_from', String(opts.yearFrom));
  if (opts.yearTo) usp.set('year_to', String(opts.yearTo));

  const resp = await fetch(`${API_BASE}/facets?${usp.toString()}`);
  if (!resp.ok) throw new DiscoveryError('No se pudieron cargar las facetas.', resp.status);

  const data = (await resp.json()) as FacetsResponse;
  _facetsCache.set(key, data);
  return data;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export async function getUsage(): Promise<any> {
  const resp = await fetch(`${API_BASE}/usage`);
  if (!resp.ok) throw new DiscoveryError('No se pudo consultar el uso.', resp.status);
  return resp.json();
}

export function workLinks(w: WorkResult) {
  return {
    doi: w.doi ? `https://doi.org/${w.doi}` : null,
    openalex: `https://openalex.org/${w.openalex_id}`,
    oa: w.oa_url || null,
  };
}

/** Mapeo WorkResult -> Work (forma compacta) para WorkCard variant="openalex". */
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
    oa_status: r.oa_status ?? undefined,
    ou: r.pdf_url ?? r.oa_url ?? undefined,
    u: r.oa_url ?? r.pdf_url ?? undefined,
    pdf_url: r.pdf_url ?? undefined,
    d: doi,
    a: (r.authors || []).map((au) => au.name),
    fwci: r.fwci ?? undefined,
    impact: r.fwci ?? undefined,
    publisher: r.publisher ?? undefined,
    field: r.field ?? undefined,
    abstract: r.abstract ?? undefined,
    issn_l: r.issn_l ?? undefined,
    qi: r.quartile ?? undefined,
    qc: r.quartile ? quartileColor(r.quartile) : undefined,
    openalex_id: r.openalex_id,
  };
}

const QUARTILE_COLORS: Record<string, string> = {
  Q1: '#15803D',
  Q2: '#CA8A04',
  Q3: '#EA580C',
  Q4: '#888888',
};

const SJR_QUARTILE_SET = new Set(['Q1', 'Q2', 'Q3', 'Q4']);

/** Oculta chips con ids técnicos (Wikidata Q…, OpenAlex P…/I…) — no confundir con cuartil SJR. */
export function isTechnicalChipLabel(value?: string | null): boolean {
  const v = (value ?? '').trim();
  if (!v) return true;
  if (SJR_QUARTILE_SET.has(v.toUpperCase())) return false;
  if (/^Q\d+$/i.test(v)) return true;
  if (/^[PI]\d+$/i.test(v)) return true;
  return false;
}

export function displayableChipLabel(value?: string | null): string | null {
  const v = (value ?? '').trim();
  if (!v || isTechnicalChipLabel(v)) return null;
  return v;
}

function quartileColor(q: string): string {
  return QUARTILE_COLORS[q] ?? '#64748b';
}
