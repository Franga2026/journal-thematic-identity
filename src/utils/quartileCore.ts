/** Funciones puras ISSN → cuartil (sin I/O; seguras en el navegador). */

export type Quartile = 'Q1' | 'Q2' | 'Q3' | 'Q4';

const QUARTILE_RANK: Record<Quartile, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };

/** Normaliza un ISSN: mayúsculas, sin guion; vacío si no tiene 8 caracteres. */
export function normIssn(s?: string | null): string {
  const v = (s ?? '').trim().toUpperCase().replace(/-/g, '');
  return v.length === 8 ? v : '';
}

/** Devuelve el MEJOR cuartil (Q1 < Q2 < Q3 < Q4) entre los ISSN de una obra,
 *  o null si ninguno está en el mapa (revista sin cuartil o no indexada en SJR). */
export function getQuartileMatch(
  map: Map<string, Quartile>,
  issns: Array<string | null | undefined>,
): { quartile: Quartile | null; matchedIssn: string | null } {
  let best: Quartile | null = null;
  let matchedIssn: string | null = null;
  for (const raw of issns) {
    const norm = normIssn(raw);
    const q = norm ? map.get(norm) : undefined;
    if (q && (best === null || QUARTILE_RANK[q] < QUARTILE_RANK[best])) {
      best = q;
      matchedIssn = norm;
    }
  }
  return { quartile: best, matchedIssn };
}

export function getQuartile(
  map: Map<string, Quartile>,
  issns: Array<string | null | undefined>,
): Quartile | null {
  return getQuartileMatch(map, issns).quartile;
}

/** Devuelve una función getQuartile curried (útil al iterar muchas obras). */
export function makeGetQuartile(map: Map<string, Quartile>) {
  return (issns: Array<string | null | undefined>): Quartile | null => getQuartile(map, issns);
}
