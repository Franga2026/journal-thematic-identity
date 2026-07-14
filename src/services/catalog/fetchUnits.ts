/**
 * Catálogo de unidades desde cris-discovery-api (Postgres / v_unit_orcid_coverage).
 * Mantiene las mismas formas que initData → getDepartments / getDeptCounts / getDeptOrcidCoverage
 * para que TabUnidades no cambie.
 */

import type { DeptOrcidCoverage } from '../../shared/types';

const API_BASE =
  (import.meta as any).env?.VITE_DISCOVERY_API_URL || 'http://localhost:8002';

export type UnitApiRow = {
  id: number;
  name: string;
  total: number;
  with_orcid: number;
  pct: number | null;
};

export type UnitsCatalog = {
  DEPTS: string[];
  deptCounts: Record<string, number>;
  deptOrcid: Record<string, DeptOrcidCoverage>;
};

type UnitsApiResponse = {
  total: number;
  results: UnitApiRow[];
};

/** Mapea la respuesta de GET /units al contrato de useApp(). */
export function mapUnitsResponse(results: UnitApiRow[]): UnitsCatalog {
  const DEPTS: string[] = [];
  const deptCounts: Record<string, number> = {};
  const deptOrcid: Record<string, DeptOrcidCoverage> = {};

  for (const u of results) {
    const name = u.name;
    if (!name) continue;
    DEPTS.push(name);
    const total = u.total ?? 0;
    const conOrcid = u.with_orcid ?? 0;
    const pct =
      u.pct != null
        ? Math.round(Number(u.pct))
        : total
          ? Math.round((100 * conOrcid) / total)
          : 0;
    deptCounts[name] = total;
    deptOrcid[name] = { total, conOrcid, pct };
  }

  return { DEPTS, deptCounts, deptOrcid };
}

/** GET /units. null si el proxy no responde (el caller usa fallback JSON). */
export async function fetchUnitsCatalog(
  signal?: AbortSignal
): Promise<UnitsCatalog | null> {
  try {
    const res = await fetch(`${API_BASE}/units`, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as UnitsApiResponse;
    if (!Array.isArray(data.results)) return null;
    return mapUnitsResponse(data.results);
  } catch {
    return null;
  }
}
