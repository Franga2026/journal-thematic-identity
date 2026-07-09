import { describe, it, expect } from 'vitest';
import {
  buildOpenAlexMetricTiles,
  computeAuthorKpis,
} from '../services/discovery/computeOpenAlexAuthorKpis';

describe('computeOpenAlexAuthorKpis', () => {
  it('computeAuthorKpis aggregates FWCI, OA and datasets from works sample', () => {
    const kpis = computeAuthorKpis(
      { h_index: 12, works_count: 50, cited_by_count: 200 },
      [
        { fwci: 1.4, is_oa: true, type: 'article' },
        { fwci: 0.8, is_oa: false, type: 'article' },
        { fwci: null, is_oa: true, type: 'dataset' },
      ],
    );
    expect(kpis.hIndex).toBe(12);
    expect(kpis.cpp).toBe(4);
    expect(kpis.fwciMean).toBe(1.1);
    expect(kpis.fwciN).toBe(2);
    expect(kpis.oaRate).toBeCloseTo(2 / 3);
    expect(kpis.datasetsCount).toBe(1);
    expect(kpis.worksSampled).toBe(3);
    expect(kpis.distinctions).toContain('Sobre media mundial');
    expect(kpis.distinctions).toContain('Comparte datos');
  });

  it('buildOpenAlexMetricTiles returns 7 tiles without UTA percentiles', () => {
    const tiles = buildOpenAlexMetricTiles({
      hIndex: 15,
      worksCount: 1200,
      citedByCount: 8000,
      cpp: 6.7,
      fwciMean: 1.35,
      fwciN: 400,
      oaRate: 0.42,
      datasetsCount: 2,
      worksSampled: 1000,
      distinctions: ['Altamente citado'],
    });
    expect(tiles).toHaveLength(7);
    expect(tiles[0].label).toBe('h-index');
    expect(tiles[1].hint).toBe('sobre 400 obras');
    expect(tiles[4].value).toBe('8K');
    expect(tiles[5].value).toBe('42%');
  });
});
