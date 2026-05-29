import type { Work, WorkCitationIndexEntry, WorkCitations } from '../../shared/types';
import { buildAllCitations } from './buildCitation';
import { getWorkCitationsIndexStore } from './citationsStore';
import { getWorkCitationId } from './workCitationId';

function fromIndexEntry(entry: WorkCitationIndexEntry): WorkCitations {
  return {
    apa: entry.apa,
    ieee: entry.ieee,
    vancouver: entry.vancouver,
    bibtex: entry.bibtex,
    ris: entry.ris,
    incomplete: entry.incomplete,
  };
}

/** Citas para una obra: índice pregenerado → embebidas en work → generación en caliente. */
export function getCitationsForWork(work: Work | null | undefined): WorkCitations {
  if (!work) {
    return buildAllCitations({});
  }
  if (work.citations?.apa) {
    return work.citations;
  }
  const id = getWorkCitationId(work);
  const indexed = getWorkCitationsIndexStore()[id];
  if (indexed) {
    return fromIndexEntry(indexed);
  }
  return buildAllCitations(work);
}

export { buildCitation, buildAllCitations } from './buildCitation';
export { getWorkCitationId } from './workCitationId';
