/**
 * Elegibilidad FWCI — fuente única para tile (WorkCard) y agregado del autor.
 * Obra del año en curso: ventana de citación incompleta → no se muestra ni promedia.
 */
export const CURRENT_YEAR = new Date().getFullYear();

export type FwciEligibleInput = {
  y?: number | string | null;
  impact?: number | null;
  fwci?: number | null;
};

export function fwciIsEligible(w: FwciEligibleInput | null | undefined): boolean {
  if (!w) return false;
  const yearRaw = w.y;
  const year = yearRaw != null && yearRaw !== '' ? Number(yearRaw) : null;
  if (year == null || Number.isNaN(year) || year >= CURRENT_YEAR) return false;
  const impact = w.impact ?? w.fwci ?? null;
  return impact != null;
}
