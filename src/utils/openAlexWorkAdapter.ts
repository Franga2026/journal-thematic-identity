import type { OpenAlexWorkItem } from '../services/odsService';
import type { Work } from '../shared/types';

/** Mapea una obra de fetch OpenAlex (`OpenAlexWorkItem`) al `Work` canónico del portal. */
export function workItemToWork(item: OpenAlexWorkItem): Work {
  const fwci = item.fwci ?? undefined;
  return {
    t: item.title,
    y: item.year ?? undefined,
    a: item.authors,
    d: item.doiUrl ?? undefined,
    s: item.venue ?? undefined,
    vol: item.volume ?? undefined,
    issue: item.issue ?? undefined,
    pages: item.pages ?? undefined,
    tp: item.docType ?? undefined,
    u: item.doiUrl ?? undefined,
    openalex_id: item.id,
    c: item.citedByCount,
    oa: item.isOpenAccess,
    impact: fwci,
    fwci,
  };
}
