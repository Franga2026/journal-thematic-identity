import type { Researcher, Work } from '../shared/types';
import { SDG_ES, SDG_NAME_TO_NUMBER } from './constants';
import { cleanOrcid, getResearcherUtaId, normalizeAuthorName } from './helpers';
import { sortResearchersByPerfilesOrder } from './perfilesOrder';
import { sdgNumFromName } from './sdgNormalize';

function normalizeSdgLabel(value: string): string {
  return value.trim().toLowerCase();
}

/** ¿La obra pertenece al ODS? Acepta nombre EN, etiqueta ES, SDG12, ODS12 o número. */
export function workMatchesSdg(work: Work, sdgName: string, sdgNum?: number | null): boolean {
  const target = normalizeSdgLabel(sdgName);
  const numTarget =
    sdgNum != null && sdgNum >= 1 && sdgNum <= 17
      ? sdgNum
      : sdgNumFromName(sdgName) ?? null;

  return (work.sdgs || []).some((raw) => {
    const label = normalizeSdgLabel(raw);
    if (label === target) return true;

    if (numTarget != null) {
      const fromEnKey = SDG_NAME_TO_NUMBER[raw as keyof typeof SDG_NAME_TO_NUMBER];
      if (fromEnKey === numTarget) return true;

      const esPair = Object.entries(SDG_ES).find(([, es]) => normalizeSdgLabel(es) === label);
      if (esPair && SDG_NAME_TO_NUMBER[esPair[0] as keyof typeof SDG_NAME_TO_NUMBER] === numTarget) {
        return true;
      }

      if (label === `sdg${numTarget}` || label === `ods${numTarget}`) return true;
    }
    return false;
  });
}

export function filterWorksBySdg(
  works: Work[],
  sdgName: string,
  sdgNum?: number | null
): Work[] {
  return works.filter((w) => workMatchesSdg(w, sdgName, sdgNum));
}

/** IDs únicos en autores_uta de un conjunto de obras */
export function collectAutoresUtaIds(works: Work[]): Set<string> {
  const ids = new Set<string>();
  works.forEach((w) => {
    (w.autores_uta || []).forEach((id) => {
      const trimmed = (id || '').trim();
      if (trimmed) ids.add(trimmed);
    });
  });
  return ids;
}

/** Cruza IDs con investigadores UTA (RUT/id u ORCID) */
export function resolveUtaResearchers(linkedIds: Iterable<string>, data: Researcher[]): Researcher[] {
  const index = new Map<string, Researcher>();

  data.forEach((r) => {
    const utaId = getResearcherUtaId(r);
    if (utaId) index.set(utaId, r);
    if (r.id) index.set(r.id.trim(), r);
    const orcid = cleanOrcid(r.o);
    if (orcid) index.set(orcid, r);
  });

  const resolved: Researcher[] = [];
  const seen = new Set<Researcher>();

  for (const rawId of linkedIds) {
    const r = index.get(rawId.trim());
    if (r && !seen.has(r)) {
      seen.add(r);
      resolved.push(r);
    }
  }

  return sortResearchersByPerfilesOrder(resolved, data);
}

export interface UtaResearcherSdgRow {
  researcher: Researcher;
  publicationCount: number;
}

export function buildUtaResearchersForSdg(
  works: Work[],
  data: Researcher[],
  sdgName: string
): UtaResearcherSdgRow[] {
  const sdgWorks = filterWorksBySdg(works, sdgName);
  const linkedIds = collectAutoresUtaIds(sdgWorks);
  const researchers = resolveUtaResearchers(linkedIds, data);

  return researchers.map((researcher) => {
    const utaId = getResearcherUtaId(researcher);
    const orcid = cleanOrcid(researcher.o);
    const publicationCount = sdgWorks.filter((w) => {
      const linked = w.autores_uta || [];
      return linked.includes(utaId) || Boolean(orcid && linked.includes(orcid));
    }).length;

    return { researcher, publicationCount };
  });
}
