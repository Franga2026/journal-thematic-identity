import type { Researcher, Work } from '../shared/types';
import { getAW, getWorksForResearcher } from './dataProcessing';
import { getResearcherUtaId } from './helpers';
import { workHasResearcher } from './utaAuthorLinks';
import { loadAuthorWorks } from '../services/authorWorksLoader';

export { getResearcherUtaId, getWorksForResearcher };

/**
 * Obras vinculadas al investigador (sync, corpus en memoria).
 * Preferir `loadEnrichedWorksForResearcher` en UI del modal.
 */
export function getEnrichedWorksForResearcher(researcher: Researcher): Work[] {
  return getWorksForResearcher(researcher);
}

/**
 * Carga bajo demanda las obras del investigador (`public/data/works/{id}.json`).
 */
export async function loadEnrichedWorksForResearcher(
  researcher: Researcher,
): Promise<Work[]> {
  const id = (researcher?.id || '').trim();
  if (!id) return [];
  return loadAuthorWorks(id);
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
