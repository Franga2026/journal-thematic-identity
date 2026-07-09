/**
 * Cuartil SJR (Scimago 2025) en el navegador — misma fuente que el proxy
 * cris-discovery-api (scripts/data/sjr-2025-quartiles.json).
 */

import { getQuartile, normIssn, type Quartile } from './quartileCore';

let mapPromise: Promise<Map<string, Quartile>> | null = null;

export async function getScimagoQuartileMap(): Promise<Map<string, Quartile>> {
  if (!mapPromise) {
    mapPromise = import('../../scripts/data/sjr-2025-quartiles.json').then((mod) => {
      const obj = (mod.default ?? mod) as Record<string, Quartile>;
      return new Map(Object.entries(obj));
    });
  }
  return mapPromise;
}

const QUARTILE_RANK: Record<Quartile, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };

const JOURNAL_WORK_TYPES = new Set(['article', 'review', 'letter', 'preprint']);
const BOOK_SOURCE_TYPES = new Set(['book', 'ebook', 'book-series']);

function issnCandidatesFromSource(source: {
  issn_l?: string | null;
  issn?: string[] | null;
}): string[] {
  const out: string[] = [];
  if (source.issn_l) out.push(String(source.issn_l));
  for (const raw of source.issn || []) {
    if (raw) out.push(String(raw));
  }
  return out;
}

function looksLikeBookDoi(doi?: string | null): boolean {
  if (!doi) return false;
  const d = doi.toLowerCase().replace('https://doi.org/', '');
  return (
    /10\.1016\/b\d/.test(d)
    || /10\.1007\/978[-0-9]/.test(d)
    || /10\.1201\/978/.test(d)
    || /10\.4324\/978/.test(d)
  );
}

function isJournalArticle(workType: string, source: { type?: string | null; issn_l?: string | null }): boolean {
  if (!JOURNAL_WORK_TYPES.has(workType)) return false;
  const srcType = (source.type || '').trim().toLowerCase();
  if (BOOK_SOURCE_TYPES.has(srcType)) return false;
  if (srcType === 'repository') return false;
  return Boolean(source.issn_l) || ['journal', 'conference'].includes(srcType);
}

/** Mejor cuartil entre candidatos ISSN; null si no está en Scimago. */
export function quartileFromIssns(
  map: Map<string, Quartile>,
  issns: string[],
): Quartile | null {
  let best: Quartile | null = null;
  for (const raw of issns) {
    const q = getQuartile(map, [raw]);
    if (q && (best === null || QUARTILE_RANK[q] < QUARTILE_RANK[best])) {
      best = q;
    }
  }
  return best;
}

export function quartileForOpenAlexWork(
  map: Map<string, Quartile>,
  work: {
    type?: string | null;
    doi?: string | null;
    primary_location?: { source?: { type?: string | null; issn_l?: string | null; issn?: string[] | null } | null } | null;
  },
): Quartile | null {
  const source = work.primary_location?.source || {};
  const srcType = (source.type || '').trim().toLowerCase();
  let workType = (work.type || '').trim() || 'other';
  if (JOURNAL_WORK_TYPES.has(workType) || workType === 'preprint') {
    if (BOOK_SOURCE_TYPES.has(srcType) || looksLikeBookDoi(work.doi)) {
      workType = 'book-chapter';
    }
  }
  if (!isJournalArticle(workType, source)) return null;
  return quartileFromIssns(map, issnCandidatesFromSource(source));
}

export { normIssn };
