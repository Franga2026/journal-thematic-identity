/**
 * sourceAccess.ts — Consulta el nivel de acceso institucional de una fuente.
 *
 * Carga `source_access.json` (generado desde KBARTs) y permite determinar
 * si una revista/fuente tiene acceso fulltext (suscripción), es OA, o
 * solo está indexada.
 *
 * Uso:
 *   import { getSourceAccess, SOURCE_ACCESS } from '../services/sources/sourceAccess';
 *   const access = getSourceAccess(work.s);
 *   // access === 'oa' | 'subscribed' | 'none'
 */

export type SourceAccessLevel = 'oa' | 'subscribed' | 'none';

export const SOURCE_ACCESS = {
  OA: 'oa' as const,
  SUBSCRIBED: 'subscribed' as const,
  NONE: 'none' as const,
};

interface AccessLookup {
  t: Record<string, number>; // normalized title → 1 (subscribed) | 2 (oa)
  i: Record<string, number>; // ISSN → 1 | 2
}

let _lookup: AccessLookup | null = null;
let _loading: Promise<void> | null = null;

function normTitle(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Carga el lookup de acceso. Se llama automáticamente la primera vez.
 * El JSON pesa ~2.4 MB y se cachea en memoria.
 */
export async function loadAccessLookup(): Promise<void> {
  if (_lookup) return;
  if (_loading) return _loading;

  _loading = fetch('/data/source_access.json')
    .then((r) => r.json())
    .then((data: AccessLookup) => {
      _lookup = data;
    })
    .catch((err) => {
      console.warn('[sourceAccess] No se pudo cargar source_access.json:', err);
      _lookup = { t: {}, i: {} };
    });

  return _loading;
}

function codeToLevel(code: number | undefined): SourceAccessLevel {
  if (code === 2) return SOURCE_ACCESS.OA;
  if (code === 1) return SOURCE_ACCESS.SUBSCRIBED;
  return SOURCE_ACCESS.NONE;
}

/**
 * Determina el nivel de acceso de una fuente por su título.
 * Retorna 'oa', 'subscribed', o 'none'.
 * Si el lookup no está cargado, retorna 'none'.
 */
export function getSourceAccess(sourceTitle?: string): SourceAccessLevel {
  if (!_lookup || !sourceTitle) return SOURCE_ACCESS.NONE;
  const norm = normTitle(sourceTitle);
  const code = _lookup.t[norm];
  return codeToLevel(code);
}

/**
 * Determina el nivel de acceso por ISSN.
 */
export function getSourceAccessByISSN(issn?: string): SourceAccessLevel {
  if (!_lookup || !issn) return SOURCE_ACCESS.NONE;
  const clean = issn.trim().toUpperCase();
  const code = _lookup.i[clean];
  return codeToLevel(code);
}

/**
 * Determina el nivel de acceso, probando título e ISSN.
 * Retorna el mejor nivel encontrado.
 */
export function getBestAccess(sourceTitle?: string, issn?: string): SourceAccessLevel {
  const byTitle = getSourceAccess(sourceTitle);
  if (byTitle === SOURCE_ACCESS.OA) return byTitle;
  const byIssn = getSourceAccessByISSN(issn);
  // Return the higher access level
  if (byIssn === SOURCE_ACCESS.OA) return byIssn;
  if (byTitle === SOURCE_ACCESS.SUBSCRIBED || byIssn === SOURCE_ACCESS.SUBSCRIBED) {
    return SOURCE_ACCESS.SUBSCRIBED;
  }
  return SOURCE_ACCESS.NONE;
}

/**
 * Verifica si el lookup está cargado.
 */
export function isAccessLookupLoaded(): boolean {
  return _lookup !== null;
}

/**
 * Hook-friendly: carga el lookup y retorna stats.
 */
export function getAccessStats(): { titles: number; issns: number; loaded: boolean } {
  if (!_lookup) return { titles: 0, issns: 0, loaded: false };
  return {
    titles: Object.keys(_lookup.t).length,
    issns: Object.keys(_lookup.i).length,
    loaded: true,
  };
}

export interface SourceInfo {
  access: SourceAccessLevel;
  publisher: string | null;
}

/** Acceso institucional y editorial asociados a una fuente (título de revista). */
export function getSourceInfo(sourceTitle?: string): SourceInfo {
  const access = getSourceAccess(sourceTitle);
  return { access, publisher: null };
}
