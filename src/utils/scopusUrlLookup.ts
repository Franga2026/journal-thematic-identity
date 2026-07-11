/**
 * scopusUrlLookup.ts — URL de revista en Scopus por ISSN (índice compacto).
 *
 * Separado de `scopusIndex.ts` (Node + KBART crudo / Set para enrich:scopus)
 * para poder usarlo en el browser sin arrastrar `node:fs`.
 *
 * Fuente: `public/data/scopus_index.json` — array de ISSN `XXXX-XXXX`
 * (generado por `scripts/build-scopus-index.mjs`).
 *
 * URL reconstruida:
 *   https://www.scopus.com/scopus/openurl/link.url?svc.citedby=1&rft.issn=XXXX-XXXX
 *
 * Uso:
 *   await loadScopusUrlIndex();
 *   const url = getScopusUrl(work.issn_l);
 */

/** Plantilla OpenURL Scopus (cited-by) por ISSN. */
export const SCOPUS_ISSN_URL_TEMPLATE =
  'https://www.scopus.com/scopus/openurl/link.url?svc.citedby=1&rft.issn=';

/** Normaliza un ISSN al formato XXXX-XXXX (igual criterio que el builder). */
export function normIssnHyphenated(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (s.length !== 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Construye la URL Scopus a partir de un ISSN ya normalizado (XXXX-XXXX). */
export function buildScopusUrl(issnHyphenated: string): string {
  return `${SCOPUS_ISSN_URL_TEMPLATE}${issnHyphenated}`;
}

let _issnSet: Set<string> | null = null;
let _loading: Promise<void> | null = null;

/**
 * Carga la lista de ISSN indexados. Idempotente; cachea un Set en memoria.
 */
export async function loadScopusUrlIndex(): Promise<void> {
  if (_issnSet) return;
  if (_loading) return _loading;

  _loading = fetch('/data/scopus_index.json')
    .then((r) => {
      if (!r.ok) throw new Error(`scopus_index.json HTTP ${r.status}`);
      return r.json();
    })
    .then((data: unknown) => {
      // Formato nuevo: string[]. Compat: objeto { ISSN → url } del índice viejo.
      if (Array.isArray(data)) {
        _issnSet = new Set(data.filter((x): x is string => typeof x === 'string'));
      } else if (data && typeof data === 'object') {
        _issnSet = new Set(Object.keys(data as Record<string, unknown>));
      } else {
        _issnSet = new Set();
      }
    })
    .catch((err) => {
      console.warn('[scopusUrlLookup] No se pudo cargar scopus_index.json:', err);
      _issnSet = new Set();
    });

  return _loading;
}

/** @internal — tests / inyección sin fetch. */
export function setScopusUrlIndexForTests(issns: Iterable<string> | null): void {
  _issnSet = issns ? new Set(issns) : null;
  _loading = null;
}

/**
 * Devuelve la URL de la revista en Scopus para un ISSN dado, o null si
 * no está en el índice (o el ISSN es inválido / el índice no cargó).
 */
export function getScopusUrl(issn: string | null | undefined): string | null {
  const norm = normIssnHyphenated(issn);
  if (!norm || !_issnSet || !_issnSet.has(norm)) return null;
  return buildScopusUrl(norm);
}

/** ¿La revista (por ISSN) está indexada en Scopus según el índice compacto? */
export function isScopusIndexedByUrl(issn: string | null | undefined): boolean {
  return getScopusUrl(issn) !== null;
}

/** Primera URL Scopus entre varios ISSN candidatos (issn[] + issn_l). */
export function getScopusUrlFromIssns(
  issns: Array<string | null | undefined>,
): string | null {
  for (const issn of issns) {
    const url = getScopusUrl(issn);
    if (url) return url;
  }
  return null;
}
