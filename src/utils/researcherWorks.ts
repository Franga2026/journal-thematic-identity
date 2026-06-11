import type { Researcher, Work } from '../shared/types';
import { getAW, getWorksForResearcher } from './dataProcessing';
import { getResearcherUtaId } from './helpers';
import { workHasResearcher } from './utaAuthorLinks';

export { getResearcherUtaId, getWorksForResearcher };

/** Obras vinculadas al investigador (enriquecimiento en ProductionWorkList). */
export function getEnrichedWorksForResearcher(researcher: Researcher): Work[] {
  return getWorksForResearcher(researcher);
}

/** Filtra obras globales vinculadas al investigador vía autores_uta */
export function filterWorksByResearcher(researcher: Researcher, allWorks: Work[] = getAW()): Work[] {
  if (!getResearcherUtaId(researcher)) return [];
  return allWorks.filter((work) => workHasResearcher(work, researcher));
}

export function researcherHasLinkedWorks(researcher: Researcher): boolean {
  if (!getResearcherUtaId(researcher)) return false;
  return getAW().some((work) => workHasResearcher(work, researcher));
}
