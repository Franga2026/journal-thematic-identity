import { CURRENT_YEAR } from '../shared/metrics/fwci';
import type { Work } from '../shared/types';

/** Sublabel compacto bajo el valor FWCI en la ficha del investigador. */
export function fwciKpiSublabel(
  fwci: number | null | undefined,
  fwciN: number | null | undefined,
): string {
  if (typeof fwciN === 'number' && fwciN > 0 && fwci != null) {
    return `sobre ${fwciN} obras · OpenAlex`;
  }
  return 'sin obras con ventana completa';
}

/** Tooltip hover/tap del KPI FWCI en la ficha. */
export function fwciKpiTooltip(fwciN: number | null | undefined): string {
  const n = typeof fwciN === 'number' && fwciN > 0 ? fwciN : 0;
  return (
    `FWCI: impacto de citación ponderado por campo. Promedio sobre las ${n} obras con ` +
    `ventana de citación completa (excluye ${CURRENT_YEAR}) indexadas en OpenAlex. La lista ` +
    `de producción muestra solo las obras vinculadas al portal por ORCID, por lo que puede ` +
    `ser un subconjunto.`
  );
}

export const OPENALEX_METRICS_UNIVERSE_NOTE =
  'Métricas calculadas sobre la producción completa indexada en OpenAlex.';

/** Valor, nota y tooltip del tile FWCI en WorkCard. */
export function fwciWorkCardTileMeta(
  w: Pick<Work, 'y'> | null | undefined,
  fwciEligible: boolean,
  fwci: number | null,
): { display: string; note: string; title?: string } {
  const fwciNa = !fwciEligible || fwci === null;
  const fwciCurrentYear = Number(w?.y) >= CURRENT_YEAR;
  return {
    display: fwciNa ? '—' : fwci.toFixed(2),
    note: !fwciNa
      ? `${fwci.toFixed(2)}× la media del campo`
      : fwciCurrentYear ? 'año en curso' : 'sin dato',
    title: !fwciNa
      ? undefined
      : fwciCurrentYear
        ? 'FWCI no disponible: obra del año en curso, ventana de citación incompleta.'
        : 'FWCI no disponible para esta obra (sin valor en OpenAlex).',
  };
}
