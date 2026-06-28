import { getAuthorOA, getData } from '../../utils/dataProcessing';
import type { Researcher } from '../../shared/types';

export interface FeaturedResearcher {
  researcher: Researcher;
  fwci: number;
  hIndex: number;
  worksCount: number;
  citedByCount: number;
}

/**
 * Investigadores destacados por FWCI institucional (OpenAlex por ORCID).
 * Seam estable: en SaaS podría resolverse desde el backend del tenant.
 */
export function getFeaturedResearchers(limit = 12, minWorks = 10): FeaturedResearcher[] {
  const ranked: FeaturedResearcher[] = [];

  for (const person of getData()) {
    const oa = getAuthorOA(person);
    if (!oa) continue;

    const worksCount = oa.works_count;
    const fwci = oa.fwci;
    if (typeof worksCount !== 'number' || worksCount < minWorks) continue;
    if (fwci == null) continue;

    ranked.push({
      researcher: person,
      fwci,
      hIndex: typeof oa.h_index === 'number' ? oa.h_index : 0,
      worksCount,
      citedByCount: typeof oa.cited_by_count === 'number' ? oa.cited_by_count : 0,
    });
  }

  return ranked.sort((a, b) => b.fwci - a.fwci).slice(0, limit);
}
