import { describe, it, expect } from 'vitest';
import {
  fwciKpiSublabel,
  fwciKpiTooltip,
  fwciWorkCardTileMeta,
  OPENALEX_METRICS_UNIVERSE_NOTE,
} from '../utils/fwciKpiDisplay';
import { CURRENT_YEAR } from '../shared/metrics/fwci';

describe('fwciKpiDisplay', () => {
  it('shows eligible-works sublabel when fwci and fwciN are present', () => {
    expect(fwciKpiSublabel(1.831, 181)).toBe('sobre 181 obras · OpenAlex');
  });

  it('shows no-eligible sublabel when fwci is null', () => {
    expect(fwciKpiSublabel(null, 0)).toBe('sin obras con ventana completa');
    expect(fwciKpiSublabel(null, null)).toBe('sin obras con ventana completa');
  });

  it('shows no-eligible sublabel when fwciN is zero even if fwci exists', () => {
    expect(fwciKpiSublabel(1.2, 0)).toBe('sin obras con ventana completa');
  });

  it('builds tooltip with fwciN and CURRENT_YEAR', () => {
    expect(fwciKpiTooltip(181)).toBe(
      `FWCI: impacto de citación ponderado por campo. Promedio sobre las 181 obras con ventana de citación completa (excluye ${CURRENT_YEAR}) indexadas en OpenAlex. La lista de producción muestra solo las obras vinculadas al portal por ORCID, por lo que puede ser un subconjunto.`,
    );
  });

  it('uses zero in tooltip when there are no eligible works', () => {
    expect(fwciKpiTooltip(0)).toContain('sobre las 0 obras');
    expect(fwciKpiTooltip(null)).toContain(`excluye ${CURRENT_YEAR}`);
  });

  it('exports the OpenAlex universe block note', () => {
    expect(OPENALEX_METRICS_UNIVERSE_NOTE).toBe(
      'Métricas calculadas sobre la producción completa indexada en OpenAlex.',
    );
  });

  describe('fwciWorkCardTileMeta', () => {
    it('shows value and multiplier note when eligible', () => {
      expect(fwciWorkCardTileMeta({ y: 2023 }, true, 2.5)).toEqual({
        display: '2.50',
        note: '2.50× la media del campo',
        title: undefined,
      });
    });

    it('shows año en curso for current-year works', () => {
      expect(fwciWorkCardTileMeta({ y: CURRENT_YEAR }, false, 0)).toEqual({
        display: '—',
        note: 'año en curso',
        title: 'FWCI no disponible: obra del año en curso, ventana de citación incompleta.',
      });
    });

    it('shows sin dato when no FWCI value', () => {
      expect(fwciWorkCardTileMeta({ y: 2020 }, false, null)).toEqual({
        display: '—',
        note: 'sin dato',
        title: 'FWCI no disponible para esta obra (sin valor en OpenAlex).',
      });
    });
  });
});
