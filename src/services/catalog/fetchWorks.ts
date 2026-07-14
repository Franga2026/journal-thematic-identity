/**
 * Producción institucional vía GET /works (Postgres).
 * Mapea items API → forma Work que entiende WorkCard / ProductionWorkList.
 */

import { resolveSdgParam } from './fetchResearchers';
import type { Work } from '../../shared/types';
import type { SortKey } from '../../utils/sortWorks';

const API_BASE =
  (import.meta as any).env?.VITE_DISCOVERY_API_URL || 'http://localhost:8002';

export type WorksFacetBucket = { key: string; count: number };

export type WorksFacets = {
  year: WorksFacetBucket[];
  type: WorksFacetBucket[];
  quartile: WorksFacetBucket[];
  access: WorksFacetBucket[];
  field: WorksFacetBucket[];
};

export type WorksApiItem = {
  openalex_id?: string | null;
  title: string;
  year?: number | null;
  doi?: string | null;
  type?: string | null;
  cited_by_count?: number | null;
  fwci?: number | null;
  is_oa?: boolean | null;
  oa_status?: string | null;
  journal?: string | null;
  source_name?: string | null;
  sjr_quartile?: string | null;
  field?: string | null;
  in_scopus?: boolean;
  scopus_url?: string | null;
};

export type WorksApiResponse = {
  items: WorksApiItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
  facets: WorksFacets;
};

export type WorksQuery = {
  q?: string;
  year?: string;
  type?: string;
  access?: '' | 'open' | 'closed';
  quartile?: string;
  field?: string;
  sdg?: string;
  sort?: SortKey;
  page?: number; // 1-based
  per_page?: number;
};

/** SortKey UI → sort del API. */
export function mapWorksSort(sort?: SortKey): 'year' | 'citations' | 'fwci' {
  if (sort === 'fwci') return 'fwci';
  if (sort === 'citations') return 'citations';
  return 'year'; // year | relevance | quartile
}

export function mapApiWorkToWork(item: WorksApiItem): Work {
  const source = item.source_name || item.journal || undefined;
  return {
    t: item.title,
    title: item.title,
    y: item.year ?? undefined,
    c: item.cited_by_count ?? undefined,
    cited_by_count: item.cited_by_count ?? undefined,
    s: source,
    tp: item.type ?? undefined,
    oa: item.is_oa ?? undefined,
    d: item.doi ?? undefined,
    doi: item.doi ?? undefined,
    openalex_id: item.openalex_id ?? undefined,
    field: item.field ?? undefined,
    qi: item.sjr_quartile ?? undefined,
    fwci: item.fwci ?? undefined,
    impact: item.fwci ?? undefined,
    up_oa_status: item.oa_status ?? undefined,
    scopus_url: item.scopus_url ?? undefined,
    in_scopus: item.in_scopus,
  } as Work & { scopus_url?: string | null; in_scopus?: boolean };
}

export async function fetchWorks(
  query: WorksQuery,
  signal?: AbortSignal
): Promise<WorksApiResponse | null> {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.year) {
    const y = Number(query.year);
    if (Number.isFinite(y)) {
      params.set('year_from', String(y));
      params.set('year_to', String(y));
    }
  }
  if (query.type) params.set('type', query.type);
  if (query.access === 'open') params.set('is_oa', 'true');
  if (query.access === 'closed') params.set('is_oa', 'false');
  if (query.quartile?.trim()) params.set('quartile', query.quartile.trim());
  if (query.field?.trim()) params.set('field', query.field.trim());
  const sdg = resolveSdgParam(query.sdg || '');
  if (sdg != null) params.set('sdg', String(sdg));
  params.set('sort', mapWorksSort(query.sort));
  params.set('page', String(query.page ?? 1));
  params.set('per_page', String(query.per_page ?? 50));

  try {
    const res = await fetch(`${API_BASE}/works?${params}`, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as WorksApiResponse;
    if (!Array.isArray(data.items)) return null;
    return data;
  } catch {
    return null;
  }
}
