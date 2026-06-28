import type { Work } from '../shared/types';
import {
  CURRENT_YEAR,
  fwciIsEligible as fwciIsEligibleCore,
  type FwciEligibleInput,
} from '../shared/metrics/fwci';
import { normalizeWorkFields } from './workAccess';

export { CURRENT_YEAR, type FwciEligibleInput } from '../shared/metrics/fwci';

type WorkWithMetrics = Work & {
  fwci?: number | null;
  cited_by_count?: number;
};

/** Año de referencia para elegibilidad FWCI (dinámico). */
export function getFwciCurrentYear(): number {
  return CURRENT_YEAR;
}

/**
 * FWCI interpretable solo si la obra no es del año en curso y tiene valor.
 * Delega en src/shared/metrics/fwci.ts (tile + agregado + enrich).
 */
export function fwciIsEligible(w: Work | FwciEligibleInput | null | undefined): boolean {
  const normalized = normalizeWorkFields(w as Work) as WorkWithMetrics;
  return fwciIsEligibleCore(normalized);
}

/**
 * Citas por obra — OpenAlex `cited_by_count` persistido como `c` en all-works.json.
 * `cited_by_count` es alias de harvest; `c` es el campo canónico del bundle.
 */
export function getWorkOpenAlexCitations(work: Work | null | undefined): number {
  const w = normalizeWorkFields(work) as WorkWithMetrics;
  if (w.cited_by_count != null) return w.cited_by_count;
  return w.c ?? 0;
}

/**
 * FWCI por obra — OpenAlex `work.fwci` persistido como `impact` en all-works.json.
 * `fwci` es alias explícito post-enriquecimiento; `impact` es el campo canónico del bundle.
 * Retorna null si no hay dato (distinto de 0, que es un FWCI válido en OpenAlex).
 */
export function getWorkOpenAlexFwci(work: Work | null | undefined): number | null {
  const w = normalizeWorkFields(work) as WorkWithMetrics;
  if (w.fwci != null) return w.fwci;
  if (w.impact != null) return w.impact;
  return null;
}

/** Campos OpenAlex de métricas por obra para persistir en harvest / enrich. */
export function mapOpenAlexWorkMetrics(raw: {
  fwci?: number | null;
  cited_by_count?: number | null;
}): Pick<Work, 'fwci' | 'cited_by_count' | 'c' | 'impact'> {
  const fwci = raw.fwci ?? undefined;
  const cited = raw.cited_by_count ?? undefined;
  return {
    fwci,
    cited_by_count: cited,
    c: cited,
    impact: fwci ?? undefined,
  };
}

/** Formato compacto FWCI para badges (145.264 → "145×", 0.65 → "0,65×"). */
export function fmtFwci(v: number | null | undefined): string | null {
  if (v == null) return null;
  if (v >= 100) return `${Math.round(v).toLocaleString('es')}×`;
  return `${v.toLocaleString('es', { maximumFractionDigits: 2 })}×`;
}

/** Promedio FWCI por obra elegible (excluye año en curso y obras sin dato). */
export function computeMeanEligibleWorkFwci(
  works: Array<Work | FwciEligibleInput>,
): { fwci: number | null; n: number } {
  const values: number[] = [];
  for (const w of works) {
    if (!fwciIsEligible(w)) continue;
    const v = getWorkOpenAlexFwci(w as Work);
    if (v !== null) values.push(v);
  }
  if (!values.length) return { fwci: null, n: 0 };
  const mean = +(values.reduce((s, x) => s + x, 0) / values.length).toFixed(3);
  return { fwci: mean, n: values.length };
}
