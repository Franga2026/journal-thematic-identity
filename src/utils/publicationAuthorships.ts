import type { Work } from '../shared/types';

type WorkWithAuth = Work & {
  authorships?: unknown[];
  authors?: Array<{
    id?: string;
    display_name?: string;
    orcid?: string;
    institutions?: Array<{ id?: string; display_name?: string; country_code?: string }>;
    countries?: string[];
  }>;
};

/** authorships (OpenAlex) con fallback a authors / lista a[] */
export function getPublicationAuthorships(publication: Work): unknown[] {
  const p = publication as WorkWithAuth;
  if (Array.isArray(p.authorships) && p.authorships.length > 0) {
    return p.authorships;
  }
  if (Array.isArray(p.authors) && p.authors.length > 0) {
    return p.authors.map((author) => ({
      author: {
        id: author.id,
        display_name: author.display_name,
        orcid: author.orcid,
      },
      institutions: author.institutions,
      countries: author.countries,
    }));
  }
  return [];
}

export function publicationHasAuthorSignal(publication: Work): boolean {
  if (getPublicationAuthorships(publication).length > 0) return true;
  if (Array.isArray(publication.autores_uta) && publication.autores_uta.length > 0) return true;
  if ((publication.a || []).length > 0) return true;
  return false;
}
