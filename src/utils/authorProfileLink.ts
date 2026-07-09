import type { EnrichedAuthor } from '../services/discovery/enrichUniversalAuthors';
import type { Researcher } from '../shared/types';
import { cleanOrcid } from './helpers';
import { getOpenAlexAuthorProfilePath, getResearcherProfilePath } from './researcherProfile';
import type { OpenAlexAuthorSummary } from '../shared/types/openalex';

/** ID estable para abrir ficha (ORCID, RUT o OpenAlex A-id). */
export function getAuthorProfileLinkId(author: EnrichedAuthor): string | null {
  if (author.utaResearcher) {
    const orcid = cleanOrcid(author.utaResearcher.o);
    if (orcid) return orcid;
    const rut = (author.utaResearcher.id || '').trim();
    if (rut) return rut;
    return null;
  }
  const orcid = author.orcid?.trim();
  if (orcid) return orcid;
  const oaId = author.authorId?.trim();
  if (oaId) return oaId;
  return null;
}

export function authorHasProfileLink(author: EnrichedAuthor): boolean {
  return Boolean(getAuthorProfileLinkId(author));
}

export function getResearcherProfileLinkId(researcher: Researcher): string | null {
  const orcid = cleanOrcid(researcher.o);
  if (orcid) return orcid;
  const rut = (researcher.id || '').trim();
  return rut || null;
}

/** Ruta interna del portal hacia la ficha del autor. */
export function getAuthorProfilePath(
  author: EnrichedAuthor,
  basePath: '/descubrir' | '/perfiles' = '/perfiles',
  searchQuery?: string,
): string | null {
  const id = getAuthorProfileLinkId(author);
  if (!id) return null;

  if (basePath === '/descubrir') {
    const params = new URLSearchParams();
    const q = (searchQuery || '').trim();
    if (q) params.set('q', q);
    params.set('autor', id);
    return `/descubrir?${params.toString()}`;
  }

  if (author.utaResearcher) {
    return getResearcherProfilePath(author.utaResearcher);
  }

  const summary: OpenAlexAuthorSummary = {
    id,
    openAlexId: author.authorId?.trim() || id,
    display_name: author.name,
    orcid: author.orcid?.trim() || undefined,
    cited_by_count: 0,
    works_count: 0,
  };
  return getOpenAlexAuthorProfilePath(summary);
}
