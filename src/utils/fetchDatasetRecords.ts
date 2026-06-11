import {
  mapOpenAlexDatasetToRecord,
  OPENALEX_DATASET_WORK_SELECT,
  type MappedDatasetRecord,
} from './datasetOpenAlex';
import {
  buildDatasetWorksFilter,
  dedupeDatasetRecordsByOpenAlexId,
} from './datasetAuthorIds';
import type { OpenAlexClient } from './openAlexMetrics';

/** Cosecha datasets OpenAlex para un set de author.id (dedup por openalex_id de obra). */
export async function fetchDatasetRecordsForAuthorIds(
  client: OpenAlexClient,
  authorIds: string[],
): Promise<MappedDatasetRecord[]> {
  const filter = buildDatasetWorksFilter(authorIds);
  if (!filter) return [];

  const records: MappedDatasetRecord[] = [];
  for await (const w of client.iterWorks(filter, OPENALEX_DATASET_WORK_SELECT, 200)) {
    records.push(mapOpenAlexDatasetToRecord(w));
  }
  return dedupeDatasetRecordsByOpenAlexId(records);
}
