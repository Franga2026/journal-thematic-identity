import type { Work } from '../shared/types';
import { getPublicationAuthorships } from './publicationAuthorships';

export function logOdsPipeline(params: {
  sdgNum: string | number;
  normalizedSdg: string;
  publications: Work[];
  utaAuthors: number;
  iberoAuthors: number;
  globalAuthors: number;
}): void {
  if (!import.meta.env.DEV) return;

  const { sdgNum, normalizedSdg, publications, utaAuthors, iberoAuthors, globalAuthors } = params;
  const first = publications[0];
  const authorships = first ? getPublicationAuthorships(first) : [];

  let extracted = 0;
  publications.forEach((p) => {
    extracted += getPublicationAuthorships(p).length;
    extracted += (p.autores_uta || []).length;
    extracted += (p.a || []).length;
  });

  console.log('[ODS] sdgNum:', sdgNum);
  console.log('[ODS] normalizedSdg:', normalizedSdg);
  console.log('[ODS] publications:', publications.length);
  console.log('[ODS] first publication:', first ?? null);
  console.log('[ODS] first authorships:', authorships);
  console.log('[ODS] extracted authors (signals):', extracted);
  console.log('[ODS] UTA authors:', utaAuthors);
  console.log('[ODS] Ibero authors:', iberoAuthors);
  console.log('[ODS] Global authors:', globalAuthors);
}
