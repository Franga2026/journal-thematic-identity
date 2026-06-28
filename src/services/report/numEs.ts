// número en palabras (1–10); por encima usa el numeral
const NUM_ES: Record<number, string> = {
  1: 'una',
  2: 'dos',
  3: 'tres',
  4: 'cuatro',
  5: 'cinco',
  6: 'seis',
  7: 'siete',
  8: 'ocho',
  9: 'nueve',
  10: 'diez',
};

export function numEs(n: number): string {
  return NUM_ES[n] ?? String(n);
}

/** Parsea enteros desde strings del payload del informe (p. ej. "87"). */
export function parseReportInt(raw: string | number): number {
  if (typeof raw === 'number') return Math.round(raw);
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) ? n : 0;
}
