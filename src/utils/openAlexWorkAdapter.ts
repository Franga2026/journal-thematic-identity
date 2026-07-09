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
    u: item.landingUrl ?? item.oaUrl ?? undefined,
    ou: item.pdfUrl ?? item.oaUrl ?? undefined,
    pdf_url: item.pdfUrl ?? undefined,
    open_access: item.oaUrl ? { oa_url: item.oaUrl, is_oa: item.isOpenAccess } : undefined,
    primary_location: item.landingUrl ? { landing_page_url: item.landingUrl, pdf_url: item.pdfUrl ?? undefined } : undefined,
    openalex_id: item.id,
    c: item.citedByCount,
    oa: item.isOpenAccess,
    impact: fwci,
    fwci,
  };
}
