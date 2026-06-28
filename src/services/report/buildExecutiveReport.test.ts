import { describe, it, expect } from 'vitest';
import { buildExecutiveReportDocx, obraLink } from './buildExecutiveReport';
import { buildExecutiveReportData } from './reportExecutiveData';
import type { ReportMetricsResult } from './reportMetrics';
import type { CollabMetrics } from './reportCollabMetrics';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const metrics: ReportMetricsResult = {
  nombre_investigador: 'Francisco Rothhammer',
  apellido: 'Rothhammer',
  unidad: 'Instituto de Alta Investigación',
  orcid: '0000-0001-5228-1180',
  periodo_inicio: 2022,
  periodo_fin: 2026,
  fecha_snapshot: 'junio 2026',
  n_pubs: 10,
  fwci_global: 2.4,
  fwci_pct: 140,
  fwci_pct_label: '140% sobre el promedio mundial',
  cpp: 31.5,
  h_index: 8,
  pct_q1: 64,
  cagr: 10.7,
  cagr_label: '+10.7% anual',
  area_top: 'Genética',
  pct_area_top: 28,
  area_2: 'Antropología',
  pct_area_2: 22,
  pct_top10: '48.6%',
  pct_colab_intl: '75.2%',
  prod_por_anio: [{ anio: 2024, count: 5 }],
  prod_por_area: [{ area: 'Genética', count: 3, pct: 30 }],
  dist_cuartiles: { Q1: 4, Q2: 2, Q3: 1, Q4: 0 },
  obras: [
    {
      titulo: 'Test paper',
      doi: '10.1234/test',
      doi_url: 'https://doi.org/10.1234/test',
      anio: 2024,
      revista: 'Nature',
      cuartil: 'Q1',
      citas: 100,
      fwci: '3.8',
    },
  ],
};

const collab: CollabMetrics = {
  orcid: '0000-0001-5228-1180',
  nombre: 'Francisco Rothhammer',
  periodo: { from: 1985, to: 2026 },
  n_obras: 121,
  n_clasificables: 121,
  n_sin_afiliacion: 0,
  colaboracion: {
    internacional: { n: 91, pct: 75.2 },
    nacional: { n: 29, pct: 24 },
    institucional: { n: 1, pct: 0.8 },
  },
  pct_colab_intl: 75.2,
  n_paises: 3,
  paises_colaboradores: [
    { cc: 'AR', n: 10 },
    { cc: 'BR', n: 8 },
    { cc: 'PE', n: 6 },
  ],
  intersectorial_obras: {
    education: 100,
    company: 15,
    government: 71,
    healthcare: 49,
    facility: 70,
    archive: 0,
    nonprofit: 0,
    other: 0,
  },
  n_obras_con_empresa: 15,
  excelencia: {
    obras_con_percentil: 111,
    top10: { n: 54, pct: 48.6 },
    top1: { n: 16, pct: 14.4 },
  },
  top_coautores: [
    { nombre: 'Carla Gallo', orcid: '0000-0001-8348-0473', n_obras: 65, pais: 'PE', institucion: 'UPCH' },
  ],
};

describe('buildExecutiveReportDocx', () => {
  it('obraLink prioriza DOI persistente', () => {
    expect(obraLink({ anio: 2024, titulo: 'X', revista: 'Y', cuartil: 'Q1', citas: 1, doi: '10.1/abc' })).toBe(
      'https://doi.org/10.1/abc',
    );
    expect(obraLink({ anio: 1998, titulo: 'Sin DOI', revista: 'Y', cuartil: '', citas: 0 })).toBeNull();
  });

  it('genera DOCX ZIP no vacío con figuras PNG', async () => {
    const figures = {
      fig_produccion: PNG_1X1,
      fig_areas: PNG_1X1,
      fig_cuartiles: PNG_1X1,
      fig_colab_tipo: PNG_1X1,
      fig_colab_paises: PNG_1X1,
      fig_colab_intersectorial: PNG_1X1,
    };
    const buf = await buildExecutiveReportDocx({
      ...buildExecutiveReportData(metrics, collab, [
        {
          t: 'Full list paper',
          y: 2023,
          c: 10,
          d: '10.5555/full',
          qi: 'Q1',
          authorships: [{ author: { orcid: '0000-0001-5228-1180' } }],
        },
      ], 'período 2022–2026'),
      figures,
    });
    expect(buf.length).toBeGreaterThan(2000);
    expect(buf.subarray(0, 2).toString()).toBe('PK');
  });
});
