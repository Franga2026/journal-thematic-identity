import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchDataCiteUsage, clearDataCiteUsageCache } from './datasetUsage';

const dcResponse = (
  attrs: Record<string, unknown>,
  ok = true,
  status = 200,
) =>
  ({
    ok,
    status,
    json: async () => ({ data: { attributes: attrs } }),
  }) as unknown as Response;

beforeEach(() => {
  clearDataCiteUsageCache();
  vi.restoreAllMocks();
});

describe('fetchDataCiteUsage', () => {
  it('normaliza el DOI (quita https://doi.org/ y baja a minúsculas)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(dcResponse({ viewCount: 5, downloadCount: 2, citationCount: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchDataCiteUsage('https://doi.org/10.6084/M9.figshare.32574419.v1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://api.datacite.org/dois/10.6084/m9.figshare.32574419.v1',
    );
  });

  it('devuelve los conteos parseados a número', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(dcResponse({ viewCount: 15, downloadCount: 1, citationCount: 3 })),
    );
    const usage = await fetchDataCiteUsage('10.6084/m9.figshare.1');
    expect(usage).toEqual({ viewCount: 15, downloadCount: 1, citationCount: 3 });
  });

  it('aplica fallback 0 cuando faltan campos o son null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(dcResponse({ viewCount: null })));
    const usage = await fetchDataCiteUsage('10.6084/m9.figshare.2');
    expect(usage).toEqual({ viewCount: 0, downloadCount: 0, citationCount: 0 });
  });

  it('cachea: segunda llamada al mismo DOI no vuelve a hacer fetch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(dcResponse({ viewCount: 7, downloadCount: 4, citationCount: 0 }));
    vi.stubGlobal('fetch', fetchMock);

    const a = await fetchDataCiteUsage('10.6084/m9.figshare.3');
    const b = await fetchDataCiteUsage('10.6084/m9.figshare.3');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a);
  });

  it('404 → null y se cachea (no reintenta)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(dcResponse({}, false, 404));
    vi.stubGlobal('fetch', fetchMock);

    expect(await fetchDataCiteUsage('10.6084/m9.figshare.404')).toBeNull();
    await fetchDataCiteUsage('10.6084/m9.figshare.404');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('error de red → null sin lanzar, y NO se cachea (permite reintento)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    vi.stubGlobal('fetch', fetchMock);

    expect(await fetchDataCiteUsage('10.6084/m9.figshare.5')).toBeNull();
    await fetchDataCiteUsage('10.6084/m9.figshare.5');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('DOI vacío tras normalizar → null sin fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await fetchDataCiteUsage('https://doi.org/')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
