import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchCoAuthorDatasetRecords,
  fetchCoAuthorDatasetsCount,
} from '../services/coauthors/coAuthorDatasetsCount';

describe('fetchCoAuthorDatasetsCount', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns meta.count from OpenAlex works filter by author id', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ meta: { count: 3 } }),
    } as Response);

    const count = await fetchCoAuthorDatasetsCount({
      oaId: 'https://openalex.org/A5086839876',
    });

    expect(count).toBe(3);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/works?');
    expect(url).toContain('type%3Adataset');
    expect(url).toContain('A5086839876');
  });

  it('returns 0 when author has no datasets', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ meta: { count: 0 } }),
    } as Response);

    const count = await fetchCoAuthorDatasetsCount({
      oaId: 'https://openalex.org/A1234567890',
    });

    expect(count).toBe(0);
  });

  it('resolves author id by ORCID when oaId is missing', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: 'https://openalex.org/A9999999999' }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ meta: { count: 2 } }),
      } as Response);

    const count = await fetchCoAuthorDatasetsCount({
      orcid: '0000-0001-5825-4191',
    });

    expect(count).toBe(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/authors?');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/works?');
  });

  it('fetches paginated dataset works and maps to DatasetRecord shape', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'https://openalex.org/W123',
            doi: '10.5281/zenodo.123',
            display_name: 'Genome assembly data',
            publication_year: 2021,
            cited_by_count: 4,
            open_access: { is_oa: true },
            primary_location: {
              is_oa: true,
              landing_page_url: 'https://zenodo.org/record/123',
              source: { display_name: 'Zenodo' },
            },
            authorships: [{ author: { display_name: 'K. Adhikari' } }],
          },
        ],
        meta: { next_cursor: null },
      }),
    } as Response);

    const records = await fetchCoAuthorDatasetRecords({
      oaId: 'https://openalex.org/A5086839876',
    });

    expect(records).toHaveLength(1);
    expect(records[0].title).toBe('Genome assembly data');
    expect(records[0].repo).toBe('Zenodo');
    expect(records[0].is_oa).toBe(true);
    expect(records[0].access_url).toBe('https://zenodo.org/record/123');
    expect(records[0].openalex_id).toBe('W123');
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('select=');
    expect(url).toContain('cursor=');
  });
});
