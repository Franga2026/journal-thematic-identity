import type { Work } from '../shared/types';

/** OpenAlex work id corto (W123…) desde URL o id completo. */
export function shortOpenAlexWorkId(id?: string | null): string {
  if (!id) return '';
  return id.replace(/^https?:\/\/openalex\.org\/works\//i, '')
    .replace(/^https?:\/\/openalex\.org\//i, '')
    .trim();
}

/**
 * Campos locales mínimos al mapear una obra cosechada desde OpenAlex.
 * Uso en pipelines de cosecha: siempre persistir openalex_id = work.id.
 */
export function mapOpenAlexHarvestFields(raw: {
  id?: string | null;
  title?: string | null;
  publication_year?: number | null;
  cited_by_count?: number | null;
  fwci?: number | null;
  doi?: string | null;
}): Pick<Work, 'openalex_id' | 't' | 'y' | 'c' | 'd' | 'fwci' | 'cited_by_count' | 'impact'> {
  const openalex_id = shortOpenAlexWorkId(raw.id);
  const doi = raw.doi?.trim() || undefined;
  const cited = raw.cited_by_count ?? undefined;
  const fwci = raw.fwci ?? undefined;
  return {
    openalex_id: openalex_id || undefined,
    t: raw.title?.trim() || undefined,
    y: raw.publication_year ?? undefined,
    c: cited,
    cited_by_count: cited,
    fwci,
    impact: fwci,
    d: doi,
  };
}
