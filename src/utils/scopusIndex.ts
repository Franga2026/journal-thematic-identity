// =============================================================================
// scopusIndex.ts — Set de ISSN indexados en Scopus, construido desde el KBART
// -----------------------------------------------------------------------------
// Lado NODE (lo usa el script de enriquecimiento). NO importar en componentes React:
// el KBART pesa ~17 MB y este módulo usa `node:fs`.
//
// Fuente: KBART de cobertura de Scopus (6569_elsevier_scopus_kbart.txt).
// Ubicación esperada: scripts/data/6569_elsevier_scopus_kbart.txt (fuera del bundle).
//
// URLs Scopus por ISSN (browser): ver `scopusUrlLookup.ts` + public/data/scopus_index.json
// (generado con `npm run build:scopus-index`). No mezclar aquí: el JSON ~12 MB
// no debe entrar al bundle vía import estático ni arrastrar node:fs al front.
// =============================================================================

import { readFileSync } from 'node:fs';

/** Normaliza un ISSN: mayúsculas, sin guion; vacío si no tiene 8 caracteres. */
export function normIssn(s?: string | null): string {
  const v = (s ?? '').trim().toUpperCase().replace(/-/g, '');
  return v.length === 8 ? v : '';
}

/** Lee el KBART (TSV) y devuelve el conjunto de ISSN indexados en Scopus
 *  (combina print_identifier y online_identifier). */
export function buildScopusIssnSet(kbartPath: string): Set<string> {
  const lines = readFileSync(kbartPath, 'utf8').split(/\r?\n/);
  if (lines.length === 0) return new Set<string>();

  const header = lines[0].split('\t');
  const piIdx = header.indexOf('print_identifier');
  const oiIdx = header.indexOf('online_identifier');
  if (piIdx === -1 && oiIdx === -1) {
    throw new Error('El KBART no tiene columnas print_identifier/online_identifier.');
  }

  const set = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split('\t');
    const p = normIssn(cols[piIdx]);
    if (p) set.add(p);
    const o = normIssn(cols[oiIdx]);
    if (o) set.add(o);
  }
  return set;
}

/** ISSN candidatos de revista en una obra OpenAlex (issn[] + issn_l). */
export function workJournalIssns(work: {
  primary_location?: { source?: { issn?: string[]; issn_l?: string | null } };
}): string[] {
  const src = work.primary_location?.source;
  if (!src) return [];
  const raw: Array<string | null | undefined> = [...(src.issn ?? []), src.issn_l];
  return raw.map(normIssn).filter((n): n is string => n !== '');
}

/** Devuelve una función que dice si alguno de los ISSN de una obra está en Scopus. */
export function makeIsScopusIndexed(set: Set<string>) {
  return (issns: Array<string | null | undefined>): boolean =>
    issns.some((x) => {
      const n = normIssn(x);
      return n !== '' && set.has(n);
    });
}
