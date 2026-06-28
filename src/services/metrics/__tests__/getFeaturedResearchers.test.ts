import { describe, it, expect, beforeAll } from 'vitest';
import { initData } from '../../../utils/dataProcessing';
import { getFeaturedResearchers } from '../getFeaturedResearchers';

describe('getFeaturedResearchers', () => {
  beforeAll(() => {
    initData({
      DATA: [
        { f: 'Alta', l: 'FWCI', o: '0000-0001-0000-0001', t: 'Profesor' },
        { f: 'Baja', l: 'Muestra', o: '0000-0002-0000-0002', t: 'Investigador' },
        { f: 'Sin', l: 'OA', o: '', t: 'Docente' },
      ],
      OA: {
        authors: {
          '0000-0001-0000-0001': {
            fwci: 6.9,
            works_count: 72,
            h_index: 19,
            cited_by_count: 500,
          },
          '0000-0002-0000-0002': {
            fwci: 19.9,
            works_count: 1,
            h_index: 1,
            cited_by_count: 10,
          },
        },
      },
      AW: [],
      OD: {},
      AI: {},
      COAUTHORS: {},
      METRICS: {},
      RES_METRICS: {},
      CITATIONS: {},
      DATASETS: {},
    });
  });

  it('ranks by FWCI with minWorks threshold', () => {
    const featured = getFeaturedResearchers(12, 10);

    expect(featured).toHaveLength(1);
    expect(featured[0].researcher.f).toBe('Alta');
    expect(featured[0].fwci).toBe(6.9);
    expect(featured[0].worksCount).toBeGreaterThanOrEqual(10);
  });
});
