import { describe, it, expect, beforeAll } from 'vitest';
import { initData, enrichWork, filterWorks, getAW } from '../utils/dataProcessing';
import type { Work } from '../shared/types';
import DATA from '../data.json';
import OA from '../openalex.json';
import AW from '../all-works.json';

beforeAll(() => {
  initData({
    DATA,
    OA,
    AW,
    OD: {},
    AI: {},
    COAUTHORS: {},
    METRICS: {},
    RES_METRICS: {},
    CITATIONS: {},
  });
});

describe('openalex_id production pipeline', () => {
  it('preserves openalex_id through double enrichWork (TabProduccion + ProductionWorkList)', () => {
    const raw = getAW().find((w) => (w.d || '').includes('10.1016/j.jasrep.2026.105837'));
    expect(raw?.openalex_id).toBe('W7162097201');

    const once = enrichWork(raw);
    const twice = enrichWork(once);

    expect(once?.openalex_id).toBe('W7162097201');
    expect(twice?.openalex_id).toBe('W7162097201');
  });

  it('restores openalex_id from catalog when partial work lacks it', () => {
    const raw = getAW().find((w) => (w.d || '').includes('10.1016/j.jasrep.2026.105837'));
    const partial = { t: raw?.t, y: raw?.y, c: raw?.c, d: raw?.d, impact: raw?.impact };
    const enriched = enrichWork(partial);
    expect(enriched.openalex_id).toBe('W7162097201');
  });

  it('restores openalex_id on second enrich when first pass dropped it', () => {
    const raw = getAW().find((w) => (w.d || '').includes('10.1016/j.jasrep.2026.105837'));
    const once = enrichWork(raw) as Work;
    delete once.openalex_id;
    const twice = enrichWork(once);
    expect(twice.openalex_id).toBe('W7162097201');
  });
});
