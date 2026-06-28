import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { initData } from '../../../utils/dataProcessing';
import { getInstitutionalKpis } from '../getInstitutionalKpis';

const METRICS = JSON.parse(
  readFileSync(join(process.cwd(), 'src/institutional-metrics.json'), 'utf8'),
);

describe('getInstitutionalKpis', () => {
  beforeAll(() => {
    initData({
      DATA: [],
      OA: {
        institution: {
          h_index: 137,
          counts_by_year: [{ year: 2024, works_count: 1172 }],
        },
      },
      AW: [],
      OD: {},
      AI: {},
      COAUTHORS: {},
      METRICS,
      RES_METRICS: {},
      CITATIONS: {},
      DATASETS: {},
    });
  });

  it('returns canonical KPIs from institutional-metrics', () => {
    const kpis = getInstitutionalKpis();

    expect(kpis.publications).toBe(9127);
    expect(kpis.citations).toBe(116550);
    expect(kpis.oaRate).toBeCloseTo(69.6, 1);
    expect(kpis.hIndex).toBe(120);
    expect(kpis.fwci).toBe(1);
    expect(kpis.oaBreakdown.gold).toBe(3948);
    expect(kpis.oaBreakdown.closed).toBe(2771);
    expect(kpis.productionByYear.length).toBeGreaterThan(0);
    expect(kpis.productionByYear.every((p) => p.year >= 2019)).toBe(true);
    expect(kpis.productionByYear.find((p) => p.year === 2024)?.count).toBe(1172);
  });
});
