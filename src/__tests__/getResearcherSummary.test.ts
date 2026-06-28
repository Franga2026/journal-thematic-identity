import { describe, it, expect } from 'vitest';
import { formatResearcherAnalysisAsSummary } from '../services/ai/getResearcherSummary';

describe('formatResearcherAnalysisAsSummary', () => {
  it('builds a prose paragraph from structured fields', () => {
    const text = formatResearcherAnalysisAsSummary({
      lineas_investigacion: ['arqueología', 'genética poblacional'],
      fortalezas_cientificas: ['Alta producción en Q1.'],
      ods_principales: [],
      colaboraciones_destacadas: ['UTA — Rothhammer'],
      publicaciones_clave: ['Estudio Chinchorro — 2020'],
      oportunidades_colaboracion: [],
    });
    expect(text).toContain('arqueología');
    expect(text).toContain('Chinchorro');
  });

  it('returns null when all fields are empty', () => {
    expect(
      formatResearcherAnalysisAsSummary({
        lineas_investigacion: [],
        fortalezas_cientificas: [],
        ods_principales: [],
        colaboraciones_destacadas: [],
        publicaciones_clave: [],
        oportunidades_colaboracion: [],
      }),
    ).toBeNull();
  });
});
