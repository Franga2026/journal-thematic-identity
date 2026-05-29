import type { Researcher } from '../shared/types';
import { cleanOrcid, getResearcherUtaId } from './helpers';

/** Índice en data.json (mismo orden que la pestaña Perfiles). */
export function buildPerfilesOrderIndex(catalog: Researcher[]): Map<string, number> {
  const order = new Map<string, number>();
  catalog.forEach((r, i) => {
    const utaId = getResearcherUtaId(r);
    if (utaId) order.set(utaId, i);
    const id = (r.id || '').trim();
    if (id) order.set(id, i);
    const orcid = cleanOrcid(r.o);
    if (orcid) order.set(orcid, i);
  });
  return order;
}

export function getPerfilesOrderIndex(
  researcher: Researcher,
  catalog: Researcher[] = []
): number {
  const order = buildPerfilesOrderIndex(catalog);
  const utaId = getResearcherUtaId(researcher);
  if (utaId && order.has(utaId)) return order.get(utaId)!;
  const id = (researcher.id || '').trim();
  if (id && order.has(id)) return order.get(id)!;
  const orcid = cleanOrcid(researcher.o);
  if (orcid && order.has(orcid)) return order.get(orcid)!;
  return Number.MAX_SAFE_INTEGER;
}

export function sortResearchersByPerfilesOrder(
  researchers: Researcher[],
  catalog: Researcher[]
): Researcher[] {
  const index = new Map<Researcher, number>();
  catalog.forEach((r, i) => index.set(r, i));
  return [...researchers].sort(
    (a, b) => (index.get(a) ?? getPerfilesOrderIndex(a, catalog)) - (index.get(b) ?? getPerfilesOrderIndex(b, catalog))
  );
}

export function getSdgRowPerfilesIndex(
  row: { uta_researcher_id?: string; orcid?: string },
  order: Map<string, number>
): number {
  const uta = (row.uta_researcher_id || '').trim();
  if (uta && order.has(uta)) return order.get(uta)!;
  const orcid = cleanOrcid(row.orcid);
  if (orcid && order.has(orcid)) return order.get(orcid)!;
  return Number.MAX_SAFE_INTEGER;
}

export function sortSdgRowsByPerfilesOrder<T extends { uta_researcher_id?: string; orcid?: string }>(
  rows: T[],
  catalog: Researcher[]
): T[] {
  const order = buildPerfilesOrderIndex(catalog);
  return [...rows].sort(
    (a, b) => getSdgRowPerfilesIndex(a, order) - getSdgRowPerfilesIndex(b, order)
  );
}
