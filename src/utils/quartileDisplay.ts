import type { QuartileProfile } from '../shared/types';

export const QUARTILE_NO_DATA = '—';
export const QUARTILE_SMALL_SAMPLE = 5;
export const QUARTILE_RANK_MIN_WORKS = 10;

export function formatQuartilePct(pct: number | undefined | null): string {
  if (pct == null || Number.isNaN(pct)) return QUARTILE_NO_DATA;
  return `${pct.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export interface QuartileLineDisplay {
  label: string;
  text: string;
  muted: boolean;
  note?: string;
}

/** Línea tipo «Q1: 92,6% · 25 de 27 obras con cuartil SJR». */
export function quartileSummaryLine(
  qp: QuartileProfile | null | undefined,
  kind: 'q1' | 'q1q2',
): QuartileLineDisplay {
  const label = kind === 'q1' ? 'Q1' : 'Q1+Q2';
  const wq = qp?.with_quartile ?? 0;
  if (wq === 0) {
    return { label, text: QUARTILE_NO_DATA, muted: false };
  }
  const pct = kind === 'q1' ? qp?.q1_pct : qp?.q1q2_pct;
  const count =
    kind === 'q1' ? (qp?.q1 ?? 0) : (qp?.q1 ?? 0) + (qp?.q2 ?? 0);
  if (pct == null) {
    return { label, text: QUARTILE_NO_DATA, muted: false };
  }
  const text = `${label}: ${formatQuartilePct(pct)} · ${count} de ${wq} obras con cuartil SJR`;
  if (wq > 0 && wq < QUARTILE_SMALL_SAMPLE) {
    return { label, text, muted: true, note: 'muestra insuficiente' };
  }
  return { label, text, muted: false };
}

export function isQuartileRankEligible(qp: QuartileProfile | null | undefined): boolean {
  return (qp?.with_quartile ?? 0) >= QUARTILE_RANK_MIN_WORKS;
}
