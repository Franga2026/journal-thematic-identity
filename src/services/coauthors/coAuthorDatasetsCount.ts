import { OPENALEX_BASE, OPENALEX_MAILTO } from '../sdg/constants';
import { cleanOrcid } from '../../utils/helpers';
import {
  mapOpenAlexDatasetToRecord,
  OPENALEX_DATASET_WORK_SELECT,
  type OpenAlexDatasetWork,
} from '../../utils/datasetOpenAlex';
import { dedupeDatasetRecordsByOpenAlexId } from '../../utils/datasetAuthorIds';
import type { DatasetRecord } from '../../shared/types';

interface CountResponse {
  meta?: { count?: number };
}

interface WorksPageResponse {
  results?: OpenAlexDatasetWork[];
  meta?: { next_cursor?: string | null };
}

interface AuthorsListResponse {
  results?: Array<{ id?: string }>;
}

function parseOpenAlexAuthorId(oaId?: string): string | null {
  const raw = (oaId || '').trim();
  if (!raw) return null;
  const id = raw.replace(/^https?:\/\/openalex\.org\//i, '').trim();
  return /^A\d+$/i.test(id) ? id.toUpperCase() : null;
}

async function resolveAuthorIdByOrcid(orcid?: string): Promise<string | null> {
  const clean = cleanOrcid(orcid);
  if (!clean) return null;
  const params = new URLSearchParams({
    filter: `orcid:https://orcid.org/${clean}`,
    'per-page': '1',
    mailto: OPENALEX_MAILTO,
  });
  const res = await fetch(`${OPENALEX_BASE}/authors?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as AuthorsListResponse;
  const id = data.results?.[0]?.id;
  if (!id) return null;
  return id.replace(/^https?:\/\/openalex\.org\//i, '').trim() || null;
}

/** OpenAlex author.id del colaborador (oaId o resolución por ORCID). */
export async function resolveCoAuthorOpenAlexAuthorId(input: {
  oaId?: string;
  orcid?: string;
}): Promise<string | null> {
  const fromOaId = parseOpenAlexAuthorId(input.oaId);
  if (fromOaId) return fromOaId;
  return resolveAuthorIdByOrcid(input.orcid);
}

function datasetWorksFilter(authorId: string): string {
  return `authorships.author.id:https://openalex.org/${authorId},type:dataset`;
}

/** Conteo type=dataset del colaborador en OpenAlex (meta.count, una sola llamada). */
export async function fetchCoAuthorDatasetsCount(input: {
  oaId?: string;
  orcid?: string;
}): Promise<number> {
  const authorId = await resolveCoAuthorOpenAlexAuthorId(input);
  if (!authorId) return 0;

  const params = new URLSearchParams({
    filter: datasetWorksFilter(authorId),
    'per-page': '1',
    mailto: OPENALEX_MAILTO,
  });
  const res = await fetch(`${OPENALEX_BASE}/works?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`OpenAlex works ${res.status}: ${res.statusText}`);
  }
  const data = (await res.json()) as CountResponse;
  return data.meta?.count ?? 0;
}

/** Lista paginada de datasets del colaborador (OpenAlex en vivo). */
export async function fetchCoAuthorDatasetRecords(input: {
  oaId?: string;
  orcid?: string;
}): Promise<DatasetRecord[]> {
  const authorId = await resolveCoAuthorOpenAlexAuthorId(input);
  if (!authorId) return [];

  const filter = datasetWorksFilter(authorId);
  const records: DatasetRecord[] = [];
  let cursor: string | null = '*';

  while (cursor) {
    const params = new URLSearchParams({
      filter,
      select: OPENALEX_DATASET_WORK_SELECT,
      'per-page': '200',
      mailto: OPENALEX_MAILTO,
      cursor,
    });
    const res = await fetch(`${OPENALEX_BASE}/works?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`OpenAlex works ${res.status}: ${res.statusText}`);
    }
    const data = (await res.json()) as WorksPageResponse;
    for (const work of data.results ?? []) {
      records.push(mapOpenAlexDatasetToRecord(work));
    }
    cursor = data.meta?.next_cursor ?? null;
  }

  return dedupeDatasetRecordsByOpenAlexId(records);
}
