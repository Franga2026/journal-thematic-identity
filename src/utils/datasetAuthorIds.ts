import { parseOpenAlexAuthorId } from './openAlexAuthorId';
import { normOrcidKey } from './orcidAuthorIdMap';
import type { MappedDatasetRecord } from './datasetOpenAlex';

/** author.id[] del cache ORCID→author.id (ORCID + alias block_key ya vetados). */
export function authorIdsFromOrcidMap(
  orcid: string,
  map: Record<string, string[]>,
): string[] {
  const key = normOrcidKey(orcid);
  const raw = map[key] || map[orcid] || [];
  const ids = raw
    .map((id) => parseOpenAlexAuthorId(id))
    .filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

/**
 * Set de author.id para queries de datasets.
 * Prioridad: mapa completo; si vacío, fallback al id de perfil o ids explícitos.
 */
export function resolveDatasetAuthorIds(
  orcid: string,
  map: Record<string, string[]>,
  profileAuthorId?: string | null,
  extraFallbackIds: string[] = [],
): string[] {
  const fromMap = authorIdsFromOrcidMap(orcid, map);
  if (fromMap.length) return fromMap;

  const fallbacks = [
    profileAuthorId ? parseOpenAlexAuthorId(profileAuthorId) : '',
    ...extraFallbackIds.map((id) => parseOpenAlexAuthorId(id)),
  ].filter((id): id is string => Boolean(id));

  return [...new Set(fallbacks)];
}

/** Filtro OpenAlex: authorships OR sobre author.id + type=dataset. */
export function buildDatasetWorksFilter(authorIds: string[]): string | null {
  if (!authorIds.length) return null;
  const idPart = authorIds.join('|');
  return `authorships.author.id:${idPart},type:dataset`;
}

export function dedupeDatasetRecordsByOpenAlexId<T extends { openalex_id: string }>(
  records: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const rec of records) {
    const key = rec.openalex_id?.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(rec);
  }
  return out;
}

export type { MappedDatasetRecord as DatasetRecord };
