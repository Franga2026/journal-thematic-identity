/**
 * Mapeo OpenAlex work (type=dataset) → DatasetRecord.
 * Fuente única para enrich-dataset-records y tests.
 */

export interface OpenAlexDatasetWork {
  id?: string;
  doi?: string | null;
  display_name?: string;
  publication_year?: number;
  cited_by_count?: number;
  authorships?: Array<{ author?: { display_name?: string } }>;
  open_access?: { is_oa?: boolean } | null;
  primary_location?: {
    is_oa?: boolean;
    landing_page_url?: string | null;
    license?: string | null;
    source?: { display_name?: string };
  } | null;
}

export const OPENALEX_DATASET_WORK_SELECT =
  'id,doi,display_name,publication_year,authorships,primary_location,open_access,cited_by_count';

export function shortOpenAlexId(id: string | undefined): string {
  if (!id) return '';
  const parts = id.split('/');
  return (parts[parts.length - 1] ?? '').trim();
}

/** Acceso abierto solo si OpenAlex lo marca explícitamente en alguno de los dos campos. */
export function resolveDatasetIsOa(work: OpenAlexDatasetWork): boolean {
  return work.open_access?.is_oa === true || work.primary_location?.is_oa === true;
}

function normalizeDoiUrl(doi: string | null | undefined): string | null {
  if (!doi?.trim()) return null;
  const raw = doi.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const bare = raw.replace(/^https?:\/\/doi\.org\//i, '');
  return `https://doi.org/${bare}`;
}

export function resolveDatasetAccessUrl(work: OpenAlexDatasetWork): string | null {
  const landing = work.primary_location?.landing_page_url?.trim();
  if (landing) return landing;
  return normalizeDoiUrl(work.doi);
}

export interface MappedDatasetRecord {
  openalex_id: string;
  doi: string | null;
  title: string;
  year: number | undefined;
  authors: string[];
  repo: string | null;
  is_oa: boolean;
  access_url: string | null;
  citas: number;
  license: string | null;
  /** Alias legacy — misma fuente que repo */
  repository: string | null;
  /** Alias legacy — misma fuente que access_url */
  landing_page_url: string | null;
  /** Alias legacy — misma fuente que citas */
  cited_by_count: number;
}

export function mapOpenAlexDatasetToRecord(work: OpenAlexDatasetWork): MappedDatasetRecord {
  const loc = work.primary_location;
  const repo = loc?.source?.display_name?.trim() || null;
  const accessUrl = resolveDatasetAccessUrl(work);
  const citas = work.cited_by_count ?? 0;

  return {
    openalex_id: shortOpenAlexId(work.id),
    doi: work.doi ?? null,
    title: work.display_name ?? '',
    year: work.publication_year,
    authors: (work.authorships ?? [])
      .map((a) => a.author?.display_name)
      .filter((n): n is string => Boolean(n)),
    repo,
    is_oa: resolveDatasetIsOa(work),
    access_url: accessUrl,
    citas,
    license: loc?.license ?? null,
    repository: repo,
    landing_page_url: accessUrl,
    cited_by_count: citas,
  };
}
