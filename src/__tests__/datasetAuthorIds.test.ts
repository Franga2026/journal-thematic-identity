import { describe, it, expect } from 'vitest';
import {
  authorIdsFromOrcidMap,
  buildDatasetWorksFilter,
  dedupeDatasetRecordsByOpenAlexId,
  resolveDatasetAuthorIds,
} from '../utils/datasetAuthorIds';

describe('datasetAuthorIds', () => {
  const map = {
    '0000-0002-5717-5317': ['A5079790283', 'A5023070315'],
    '0000-0001-5228-1180': ['A5022063392'],
  };

  it('reads full author.id set from map (case-insensitive ORCID)', () => {
    expect(authorIdsFromOrcidMap('0000-0002-5717-5317', map)).toEqual([
      'A5079790283',
      'A5023070315',
    ]);
  });

  it('builds OR filter for OpenAlex datasets query', () => {
    expect(buildDatasetWorksFilter(['A5079790283', 'A5023070315'])).toBe(
      'authorships.author.id:A5079790283|A5023070315,type:dataset',
    );
  });

  it('prefers map over profile fallback when map has entries', () => {
    expect(resolveDatasetAuthorIds('0000-0002-5717-5317', map, 'A9999999999')).toEqual([
      'A5079790283',
      'A5023070315',
    ]);
  });

  it('falls back to profile author id when map is empty', () => {
    expect(resolveDatasetAuthorIds('0000-0009-9999-9999', map, 'A5022063392')).toEqual([
      'A5022063392',
    ]);
  });

  it('dedupes records by openalex_id', () => {
    const out = dedupeDatasetRecordsByOpenAlexId([
      { openalex_id: 'W1', title: 'a' } as { openalex_id: string; title: string },
      { openalex_id: 'W1', title: 'b' } as { openalex_id: string; title: string },
      { openalex_id: 'W2', title: 'c' } as { openalex_id: string; title: string },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe('a');
  });
});
