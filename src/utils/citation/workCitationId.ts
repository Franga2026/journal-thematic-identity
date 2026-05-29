import type { Work } from '../../shared/types';
import { stripTags } from '../helpers';
import { cleanCitationDoi } from './normalizeCitationMeta';

/** Clave estable para índice work-citations.json */
export function getWorkCitationId(work: Work): string {
  const doi = cleanCitationDoi(work.d || work.doi);
  if (doi) return `doi:${doi.toLowerCase()}`;

  const openAlex = (work.openalex_id || '')
    .replace('https://openalex.org/', '')
    .trim();
  if (openAlex) return `openalex:${openAlex}`;

  const title = stripTags(work.t || work.title || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const year = work.y ?? '';
  if (title) return `title:${title}|y:${year}`;

  return `unknown:${JSON.stringify(work.a || []).slice(0, 40)}|y:${year}`;
}
