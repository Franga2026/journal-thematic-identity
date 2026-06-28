import type { Work } from '../shared/types';
import { fwciIsEligible } from '../shared/metrics/fwci';
import { getWorkOpenAlexCitations, getWorkOpenAlexFwci } from './workMetrics';

export type SortKey = 'relevance' | 'year' | 'citations' | 'fwci' | 'quartile';

const yearOf = (w: Work) =>
  Number(w?.y ?? (w as { publication_year?: number }).publication_year ?? 0);

const fwciOf = (w: Work) => {
  const v = fwciIsEligible(w) ? getWorkOpenAlexFwci(w) : null;
  return v ?? -Infinity;
};

/** Q1=1 … Q4=4; sin cuartil → al final (99). */
export function quartileSortKey(qi?: string): number {
  if (!qi?.trim()) return 99;
  const match = qi.trim().toUpperCase().match(/^Q?([1-4])$/);
  if (!match) return 99;
  return parseInt(match[1], 10);
}

export function sortWorks<T extends Work>(works: T[], sortBy: SortKey): T[] {
  if (sortBy === 'relevance') return works;
  const arr = [...works];
  arr.sort((a, b) => {
    if (sortBy === 'year') {
      return yearOf(b) - yearOf(a)
        || getWorkOpenAlexCitations(b) - getWorkOpenAlexCitations(a);
    }
    if (sortBy === 'citations') {
      return getWorkOpenAlexCitations(b) - getWorkOpenAlexCitations(a)
        || yearOf(b) - yearOf(a);
    }
    if (sortBy === 'quartile') {
      return quartileSortKey(a.qi) - quartileSortKey(b.qi)
        || getWorkOpenAlexCitations(b) - getWorkOpenAlexCitations(a);
    }
    return fwciOf(b) - fwciOf(a)
      || getWorkOpenAlexCitations(b) - getWorkOpenAlexCitations(a);
  });
  return arr;
}
