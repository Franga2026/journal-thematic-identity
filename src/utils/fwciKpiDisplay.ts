import { CURRENT_YEAR } from '../shared/metrics/fwci';

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
