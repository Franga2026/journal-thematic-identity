import { getAW, getAuthorOA, getData, getInstitution } from './dataProcessing';
import type { BibliometricChatContext } from '../services/ai/types';

/** Resumen compacto para chat — no incluye all-works completo */
export function buildBibliometricChatContext(): BibliometricChatContext {
  const DATA = getData();
  const AW = getAW();
  const INST = getInstitution();

  const fieldCounts: Record<string, number> = {};
  AW.forEach((w) => {
    if (w.field) fieldCounts[w.field] = (fieldCounts[w.field] || 0) + 1;
  });
  const top_fields = Object.entries(fieldCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([field, count]) => ({ field, count }));

  const top_researchers = DATA.filter((r) => r.o)
    .map((r) => {
      const oa = getAuthorOA(r);
      return {
        name: `${r.f || ''} ${r.l || ''}`.trim(),
        h_index: oa?.h_index || 0,
        pubs: oa?.works_count || 0,
        dept: (r.dp || [])[0]?.d,
      };
    })
    .sort((a, b) => b.h_index - a.h_index)
    .slice(0, 15);

  const sdg_highlights = (INST.sdgs || [])
    .slice()
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 8)
    .map((s) => ({ sdg: s.name, pubs: s.count || 0 }));

  return {
    investigators_count: DATA.length,
    publications_count: AW.length,
    institution_h_index: INST.h_index,
    top_fields,
    top_researchers,
    sdg_highlights,
  };
}
