import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearFairScoresCache, fetchFairScores } from './datasetFair';

afterEach(() => {
  clearFairScoresCache();
  vi.restoreAllMocks();
});

describe('fetchFairScores', () => {
  it('returns null for empty DOI', async () => {
    expect(await fetchFairScores('')).toBeNull();
  });

  it('returns FAIR scores when assessed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        scores: { F: 93.7, A: 77.8, I: 73.4, R: 70.6, overall: 81.04 },
      }),
    }));

    const scores = await fetchFairScores('10.17632/ysm6k6hwyz');
    expect(scores).toEqual({
      findable: 94,
      accessible: 78,
      interoperable: 73,
      reusable: 71,
      overall: 81,
    });
  });

  it('returns null when not assessed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'not_assessed' }),
    }));

    expect(await fetchFairScores('10.5281/zenodo.1')).toBeNull();
  });

  it('caches results', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        scores: { F: 80, A: 80, I: 80, R: 80, overall: 80 },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchFairScores('10.6084/m9.figshare.1');
    await fetchFairScores('10.6084/m9.figshare.1');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
