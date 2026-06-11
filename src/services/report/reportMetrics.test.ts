import { describe, it, expect } from 'vitest';
import type { Researcher, Work } from '../../shared/types';
import {
  buildReportMetricsFromWorks,
  computeAdaptivePeriod,
  computeCagr,
  computeHIndex,
  isValidOrcidFormat,
  nPubs,
  ReportMetricsError,
} from './reportMetrics';

const researcher: Researcher = {
  id: 'uta-test',
  f: 'Ana',
  l: 'Rothhammer',
  o: '0000-0001-5228-1180',
  dp: [{ d: 'Instituto de Alta Investigación' }],
};

function w(partial: Work): Work {
  return partial;
}

describe('reportMetrics — período adaptativo', () => {
  it('veterano activo: ventana de 5 años hasta snapshot', () => {
    const works = Array.from({ length: 12 }, (_, i) =>
      w({ t: `Paper ${i}`, y: 2018 + (i % 8), c: 10 + i, tp: 'article', qi: 'Q1' }),
    );
    const { inicio, fin } = computeAdaptivePeriod(works, 2026);
    expect(fin).toBe(2025);
    expect(fin - inicio + 1).toBeLessThanOrEqual(5);
    expect(inicio).toBeGreaterThanOrEqual(2018);
  });

  it('early-career: inicia en primera obra dentro de la ventana', () => {
    const works = [
      w({ t: 'A', y: 2023, c: 5, tp: 'article' }),
      w({ t: 'B', y: 2024, c: 8, tp: 'article' }),
      w({ t: 'C', y: 2025, c: 12, tp: 'article' }),
      w({ t: 'D', y: 2025, c: 3, tp: 'article' }),
      w({ t: 'E', y: 2026, c: 1, tp: 'article' }),
    ];
    const { inicio, fin } = computeAdaptivePeriod(works, 2026);
    expect(inicio).toBe(2023);
    expect(fin).toBe(2026);
  });

  it('inactivo reciente: último tramo activo', () => {
    const works = [
      w({ t: 'Old', y: 2010, c: 50, tp: 'article' }),
      w({ t: 'Old2', y: 2011, c: 40, tp: 'article' }),
      w({ t: 'Old3', y: 2012, c: 30, tp: 'article' }),
      w({ t: 'Old4', y: 2013, c: 20, tp: 'article' }),
      w({ t: 'Old5', y: 2014, c: 10, tp: 'article' }),
    ];
    const { inicio, fin } = computeAdaptivePeriod(works, 2026);
    expect(fin).toBe(2014);
    expect(inicio).toBe(2010);
  });

  it('guarda de densidad: extiende inicio si hay menos de 5 pubs', () => {
    const works = [
      w({ t: 'A', y: 2024, c: 1, tp: 'article' }),
      w({ t: 'B', y: 2025, c: 2, tp: 'article' }),
      w({ t: 'C', y: 2020, c: 3, tp: 'article' }),
      w({ t: 'D', y: 2021, c: 4, tp: 'article' }),
      w({ t: 'E', y: 2022, c: 5, tp: 'article' }),
    ];
    const { inicio, periodWorks } = computeAdaptivePeriod(works, 2026);
    expect(inicio).toBeLessThan(2024);
    expect(nPubs(periodWorks)).toBeGreaterThanOrEqual(5);
  });

  it('sin años → error 422', () => {
    expect(() => computeAdaptivePeriod([w({ t: 'X', c: 1 })], 2026)).toThrow(ReportMetricsError);
  });
});

describe('reportMetrics — métricas sobre P', () => {
  const periodWorks: Work[] = [
    w({ t: 'High', y: 2020, c: 100, tp: 'article', qi: 'Q1', impact: 2.0 }),
    w({ t: 'Mid', y: 2021, c: 50, tp: 'article', qi: 'Q2', impact: 1.0 }),
    w({ t: 'Low', y: 2022, c: 10, tp: 'article', qi: 'Q4', impact: 0.5 }),
    w({ t: 'DS', y: 2023, c: 0, tp: 'dataset' }),
    w({ t: 'None', y: 2023, c: 5, tp: 'article', field: 'Medicine' }),
    w({ t: 'None2', y: 2024, c: 15, tp: 'article', field: 'Medicine' }),
  ];

  it('calcula n_pubs, cpp, h_index, pct_q1, cagr y fwci', () => {
    const metrics = buildReportMetricsFromWorks(researcher, periodWorks, 2026, new Map());
    expect(metrics.n_pubs).toBe(5);
    expect(metrics.cpp).toBe(36);
    expect(computeHIndex(periodWorks)).toBe(5);
    expect(metrics.h_index).toBe(5);
    expect(metrics.pct_q1).toBe(33.3);
    expect(metrics.fwci_global).not.toBeNull();
    expect(metrics.obras).toHaveLength(5);
    expect(metrics.pct_top10).toBe('—');
    expect(metrics.pct_colab_intl).toBe('—');
  });

  it('CAGR usa primer año con producción como base', () => {
    const prod = [
      { anio: 2020, count: 0 },
      { anio: 2021, count: 1 },
      { anio: 2022, count: 2 },
      { anio: 2023, count: 4 },
      { anio: 2024, count: 4 },
    ];
    const cagr = computeCagr(prod, 2020, 2024);
    expect(cagr).not.toBeNull();
  });
});

describe('isValidOrcidFormat', () => {
  it('acepta ORCID válido', () => {
    expect(isValidOrcidFormat('0000-0001-5228-1180')).toBe(true);
  });
  it('rechaza formato inválido', () => {
    expect(isValidOrcidFormat('not-an-orcid')).toBe(false);
  });
});
