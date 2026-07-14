/**
 * scopusUrlLookup.ts (v2) — resuelve por ISSN o por título.
 *
 * Índice en `public/data/scopus_index.json` (fetch bajo demanda; no va al bundle).
 * Generado por `scripts/build-scopus-index.mjs`.
 */

export interface ScopusIndexV2 {
  byIssn: string[];
  byTitle: Record<string, string>;
}

/** Base OpenURL completa que Scopus exige (verificada contra el KBART). */
export const SCOPUS_OPENURL_BASE =
  'https://www.scopus.com/scopus/openurl/link.url' +
  '?ctx_ver=Z39.88-2004' +
  '&ctx_enc=info:ofi/enc:UTF-8' +
  '&svc_val_fmt=info:ofi/fmt:kev:mtx:sch_svc' +
  '&svc.source=yes' +
  '&rft_val_fmt=info:ofi/fmt:kev:mtx:journal';

/** @deprecated Usar SCOPUS_OPENURL_BASE + buildScopusUrlByIssn. */
export const SCOPUS_ISSN_URL_TEMPLATE = `${SCOPUS_OPENURL_BASE}&rft.issn=`;

let SCOPUS_DATA: ScopusIndexV2 | null = null;
let ISSN_SET: Set<string> = new Set();
let BY_TITLE: Record<string, string> = {};
let _loading: Promise<void> | null = null;

function applyIndex(data: ScopusIndexV2 | string[] | null): void {
  if (data == null) {
    SCOPUS_DATA = null;
    ISSN_SET = new Set();
    BY_TITLE = {};
    return;
  }
  if (Array.isArray(data)) {
    // Compat v1: string[]
    SCOPUS_DATA = { byIssn: data, byTitle: {} };
    ISSN_SET = new Set(data);
    BY_TITLE = {};
    return;
  }
  SCOPUS_DATA = {
    byIssn: data.byIssn ?? [],
    byTitle: data.byTitle ?? {},
  };
  ISSN_SET = new Set(SCOPUS_DATA.byIssn);
  BY_TITLE = { ...SCOPUS_DATA.byTitle };
}

function parseFetchedJson(raw: unknown): void {
  if (Array.isArray(raw)) {
    applyIndex(raw.filter((x): x is string => typeof x === 'string'));
    return;
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.byIssn) || (obj.byTitle && typeof obj.byTitle === 'object')) {
      const byIssn = Array.isArray(obj.byIssn)
        ? obj.byIssn.filter((x): x is string => typeof x === 'string')
        : [];
      const byTitle: Record<string, string> = {};
      if (obj.byTitle && typeof obj.byTitle === 'object') {
        for (const [k, v] of Object.entries(obj.byTitle as Record<string, unknown>)) {
          if (typeof v === 'string') byTitle[k] = v;
        }
      }
      applyIndex({ byIssn, byTitle });
      return;
    }
  }
  applyIndex({ byIssn: [], byTitle: {} });
}

export function normIssnHyphenated(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (s.length !== 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** @deprecated Preferir normIssnHyphenated. */
export const normIssn = normIssnHyphenated;

export function buildScopusUrlByIssn(issn: string): string {
  return `${SCOPUS_OPENURL_BASE}&rft.issn=${issn}`;
}

export function buildScopusUrlByTitle(encodedTitle: string): string {
  return `${SCOPUS_OPENURL_BASE}&rft.title=${encodedTitle}`;
}

export function buildScopusUrl(issnHyphenated: string): string {
  return buildScopusUrlByIssn(issnHyphenated);
}

export type ScopusUrlIndexTestInput =
  | Iterable<string>
  | ScopusIndexV2
  | null;

/** @internal — tests / inyección sin fetch. */
export function setScopusUrlIndexForTests(input: ScopusUrlIndexTestInput): void {
  _loading = null;
  if (input == null) {
    applyIndex(null);
    return;
  }
  if (Array.isArray(input)) {
    applyIndex([...input]);
    return;
  }
  if (typeof input === 'object' && ('byIssn' in input || 'byTitle' in input)) {
    applyIndex(input as ScopusIndexV2);
    return;
  }
  applyIndex([...(input as Iterable<string>)]);
}

/**
 * Carga el índice desde `/data/scopus_index.json` (public/). Idempotente.
 */
export async function loadScopusUrlIndex(): Promise<void> {
  if (SCOPUS_DATA) return;
  if (_loading) return _loading;

  _loading = fetch('/data/scopus_index.json')
    .then((r) => {
      if (!r.ok) throw new Error(`scopus_index.json HTTP ${r.status}`);
      return r.json();
    })
    .then((data: unknown) => {
      parseFetchedJson(data);
    })
    .catch((err) => {
      console.warn('[scopusUrlLookup] No se pudo cargar scopus_index.json:', err);
      applyIndex({ byIssn: [], byTitle: {} });
    })
    .finally(() => {
      _loading = null;
    });

  return _loading;
}

/** Alias del snippet de diseño. */
export const loadScopusIndex = loadScopusUrlIndex;

/**
 * Devuelve la URL de la revista en Scopus, o null si no está indexada /
 * el índice aún no cargó.
 */
export function getScopusUrl(issn: string | null | undefined): string | null {
  if (!SCOPUS_DATA) return null;
  const norm = normIssnHyphenated(issn);
  if (!norm) return null;
  if (BY_TITLE[norm]) {
    return buildScopusUrlByTitle(BY_TITLE[norm]);
  }
  if (ISSN_SET.has(norm)) {
    return buildScopusUrlByIssn(norm);
  }
  return null;
}

/** ¿La revista está indexada en Scopus (por ISSN o por título)? */
export function isScopusIndexed(issn: string | null | undefined): boolean {
  if (!SCOPUS_DATA) return false;
  const norm = normIssnHyphenated(issn);
  if (!norm) return false;
  return ISSN_SET.has(norm) || Boolean(BY_TITLE[norm]);
}

/** Alias histórico. */
export const isScopusIndexedByUrl = isScopusIndexed;

export function getScopusUrlFromIssns(
  issns: Array<string | null | undefined>,
): string | null {
  for (const issn of issns) {
    const url = getScopusUrl(issn);
    if (url) return url;
  }
  return null;
}

/**
 * Extracción de ISSN desde obras del corpus local + lookup en Scopus.
 *
 * PROBLEMA: el modal pedía getScopusUrl(work.issn_l), pero `issn_l` NO existe
 * en el corpus local (works-lite.json ni works/{id}.json). Los ISSN sí están,
 * en otros dos campos:
 *
 *   cr_issn (Crossref)  → array:  ['1042-0533', '1520-6300']
 *   up_issn (Unpaywall) → string: '1042-0533,1520-6300'
 *
 * Además, una revista suele tener DOS ISSN (impreso y electrónico) y Scopus
 * puede indexar cualquiera de ellos, así que hay que probarlos todos.
 *
 * Cobertura: 7.870 de 9.127 obras (86%) tienen al menos un ISSN.
 */

/**
 * Devuelve TODOS los ISSN de una obra, vengan de donde vengan.
 * Normaliza (trim) y deduplica.
 */
export function getWorkIssns(work: unknown): string[] {
  const w = work as Record<string, unknown> | null | undefined;
  if (!w) return [];
  const out = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v !== 'string') return;
    const s = v.trim();
    if (s) out.add(s);
  };
  // 1. issn_l — primero (Descubridor / OpenAlex en vivo; ausente en corpus local)
  add(w.issn_l as string);
  // 2. cr_issn (Crossref) — normalmente un array
  const cr = w.cr_issn;
  if (Array.isArray(cr)) cr.forEach(add);
  else if (typeof cr === 'string') cr.split(',').forEach(add);
  // 3. up_issn (Unpaywall) — string separado por comas
  const up = w.up_issn;
  if (typeof up === 'string') up.split(',').forEach(add);
  else if (Array.isArray(up)) up.forEach(add);
  return [...out];
}

/**
 * URL de Scopus para una obra: prueba todos sus ISSN y devuelve la primera
 * revista que esté indexada. null si ninguna lo está (→ no se pinta el chip).
 *
 * Requiere que loadScopusUrlIndex() ya se haya resuelto (el modal lo llama
 * al montar); getScopusUrl es síncrono y lee del índice en memoria.
 */
export function getScopusUrlForWork(work: unknown): string | null {
  for (const issn of getWorkIssns(work)) {
    const url = getScopusUrl(issn);
    if (url) return url;
  }
  return null;
}

/** ¿Alguna de las revistas de esta obra está indexada en Scopus? */
export function isWorkInScopus(work: unknown): boolean {
  return getScopusUrlForWork(work) !== null;
}
