/**
 * Catálogo de investigadores vía GET /researchers (Postgres).
 * Mapea filas API → Researcher local (foto, cargo) por local_id / RUT.
 */

import { getData } from '../../utils/dataProcessing';
import { SDG_NAME_TO_NUMBER } from '../../utils/constants';
import type { Researcher } from '../../shared/types';

const API_BASE =
  (import.meta as any).env?.VITE_DISCOVERY_API_URL || 'http://localhost:8002';

export type ResearcherApiItem = {
  local_id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string;
  email?: string | null;
  orcid?: string | null;
  openalex_ids?: string[];
  h_index?: number | null;
  works_count?: number | null;
  cited_by_count?: number | null;
  units?: Array<{ id: number; name: string; role?: string | null; is_primary?: boolean }>;
};

export type ResearchersApiResponse = {
  items: ResearcherApiItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
};

export type ResearchersQuery = {
  q?: string;
  unit?: string;
  has_orcid?: boolean;
  sdg?: string | number;
  field?: string;
  page?: number; // 1-based (API)
  per_page?: number;
  sort?: 'name' | 'h_index';
};

/** Resuelve ODS (nombre EN o número) → 1..17. */
export function resolveSdgParam(sdgFilter: string): number | null {
  if (!sdgFilter) return null;
  const fromName = (SDG_NAME_TO_NUMBER as Record<string, number>)[sdgFilter];
  if (fromName) return fromName;
  const n = Number(sdgFilter);
  return Number.isInteger(n) && n >= 1 && n <= 17 ? n : null;
}

/** Une fila API con el registro local (ph, t, dp…). */
export function mapApiItemToResearcher(item: ResearcherApiItem): Researcher {
  const data = (getData() as Researcher[]) || [];
  const local = data.find((r) => r.id === item.local_id);
  if (local) return local;

  return {
    id: item.local_id,
    f: item.first_name || undefined,
    l: item.last_name || undefined,
    e: item.email || undefined,
    o: item.orcid || undefined,
    dp: (item.units || []).map((u) => ({ d: u.name, j: u.role || undefined })),
  } as Researcher;
}

export async function fetchResearchers(
  query: ResearchersQuery,
  signal?: AbortSignal
): Promise<ResearchersApiResponse | null> {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.unit?.trim()) params.set('unit', query.unit.trim());
  if (query.has_orcid === true) params.set('has_orcid', 'true');
  if (query.has_orcid === false) params.set('has_orcid', 'false');
  const sdg =
    typeof query.sdg === 'number'
      ? query.sdg
      : resolveSdgParam(String(query.sdg || ''));
  if (sdg != null) params.set('sdg', String(sdg));
  if (query.field?.trim()) params.set('field', query.field.trim());
  params.set('page', String(query.page ?? 1));
  params.set('per_page', String(query.per_page ?? 24));
  if (query.sort) params.set('sort', query.sort);

  try {
    const res = await fetch(`${API_BASE}/researchers?${params}`, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as ResearchersApiResponse;
    if (!Array.isArray(data.items)) return null;
    return data;
  } catch {
    return null;
  }
}
