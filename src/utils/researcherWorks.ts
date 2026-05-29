import type { Researcher, Work } from '../shared/types';
import { getAW, enrichWork, getWorksForResearcher } from './dataProcessing';
import { cleanOrcid, getResearcherUtaId } from './helpers';

export { getResearcherUtaId, getWorksForResearcher };

/** Obras enriquecidas para UI de ficha / producción */
export function getEnrichedWorksForResearcher(researcher: Researcher): Work[] {
  return getWorksForResearcher(researcher).map((w) => enrichWork(w) as Work);
}

/** Filtra obras globales vinculadas al investigador vía autores_uta */
export function filterWorksByResearcher(researcher: Researcher, allWorks: Work[] = getAW()): Work[] {
  const utaId = getResearcherUtaId(researcher);
  if (!utaId) return [];
  const orcid = cleanOrcid(researcher.o);
  return allWorks.filter((work) => {
    const linked = work.autores_uta;
    if (!linked?.length) return false;
    return linked.includes(utaId) || Boolean(orcid && linked.includes(orcid));
  });
}

export function researcherHasLinkedWorks(researcher: Researcher): boolean {
  const utaId = getResearcherUtaId(researcher);
  if (!utaId) return false;
  const orcid = cleanOrcid(researcher.o);
  return getAW().some((w) => {
    const linked = w.autores_uta;
    return linked?.includes(utaId) || Boolean(orcid && linked?.includes(orcid));
  });
}
