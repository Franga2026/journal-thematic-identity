import type { Work } from '../shared/types';

export function workRowId(w: Work, index: number): string {
  const doi = (w.d || '').trim();
  if (doi) return doi;
  const oa = (w.openalex_id || '').replace(/^https?:\/\/openalex\.org\//i, '').trim();
  if (oa) return `oa:${oa}`;
  return `row-${index}-${w.y ?? 'y'}-${(w.t || '').slice(0, 48)}`;
}
