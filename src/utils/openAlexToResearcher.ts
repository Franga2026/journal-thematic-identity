import type { Researcher } from '../shared/types';
import type { OpenAlexAuthorDetail } from '../shared/types/openalex';

/** Convierte autor OpenAlex a Researcher mínimo para reutilizar ResearcherModal cuando hay match local */
export function openAlexDetailToResearcher(detail: OpenAlexAuthorDetail): Researcher {
  const parts = (detail.display_name || 'Sin nombre').trim().split(/\s+/);
  const f = parts[0] || 'Investigador';
  const l = parts.slice(1).join(' ') || 'OpenAlex';
  return {
    f,
    l,
    o: detail.orcid,
    id: detail.openAlexId,
    t: detail.institution,
    dp: detail.institution ? [{ d: detail.institution }] : undefined,
  };
}
