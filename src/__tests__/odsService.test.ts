import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sdgNameToNumber,
  sdgNumberToName,
  fetchOpenAlexAuthor,
  normalizeSdgNumber,
} from '../services/odsService';
import { getResearchersBySdg } from '../services/sdg/getResearchersBySdg';
import { clearSdgRankingCache } from '../services/sdg/cache';

describe('odsService', () => {
  beforeEach(() => {
    clearSdgRankingCache();
  });

  it('maps SDG names and numbers', () => {
    expect(sdgNameToNumber('Life on land')).toBe(15);
    expect(sdgNumberToName(10)).toBe('Reduced inequalities');
  });

  it('normalizeSdgNumber validates range', () => {
    expect(normalizeSdgNumber(10)).toBe(10);
    expect(() => normalizeSdgNumber(99)).toThrow();
  });

  describe('OpenAlex author profile', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('fetchOpenAlexAuthor uses OpenAlex A-id path', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'https://openalex.org/A5012345678',
          display_name: 'By A-id',
          cited_by_count: 10,
          works_count: 5,
        }),
      });
      const author = await fetchOpenAlexAuthor('A5012345678');
      expect(author.openAlexId).toBe('A5012345678');
    });
  });

  describe('getResearchersBySdg (works pipeline)', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal('fetch', fetchMock);
      clearSdgRankingCache();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('builds global ranking from works authorships', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'https://openalex.org/W1',
              cited_by_count: 40,
              authorships: [
                {
                  author: {
                    id: 'https://openalex.org/A1',
                    display_name: 'Researcher One',
                    orcid: 'https://orcid.org/0000-0002-1825-0097',
                  },
                  institutions: [
                    { id: 'https://openalex.org/I1', display_name: 'Oxford', country_code: 'GB' },
                  ],
                  countries: ['GB'],
                },
              ],
            },
          ],
          meta: { next_cursor: null },
        }),
      });

      const res = await getResearchersBySdg(10, 'global', { skipCache: true });
      expect(res.researchers.length).toBeGreaterThan(0);
      expect(res.researchers[0].author_name).toBe('Researcher One');
      expect(res.researchers[0].orcid).toBe('0000-0002-1825-0097');
      expect(res.total_works_fetched).toBe(1);
    });
  });
});
