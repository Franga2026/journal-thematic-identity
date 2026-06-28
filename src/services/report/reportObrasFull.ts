import { join } from 'node:path';
import type { Work } from '../../shared/types';
import { stripTags } from '../../utils/helpers';
import { getWorkOpenAlexCitations } from '../../utils/workMetrics';
import { loadQuartileMap, type Quartile } from '../../utils/quartileIndex';
import { normOrcid } from './reportCollabMetrics';
import { isDatasetWork, resolveWorkQuartile, workYear } from './reportMetrics';

const SJR_MAP_PATH = join(process.cwd(), 'scripts/data/sjr-2025-quartiles.json');

export interface ReportObraFullRow {
  anio: number | string;
  titulo: string;
  revista: string;
  cuartil: string;
  citas: number;
  doi?: string;
  url?: string;
  link?: string;
}

function workLandingUrl(w: Work): string | undefined {
  const u = (
    w.ou ||
    w.u ||
    w.doi_url ||
    w.primary_location?.landing_page_url ||
    w.primary_location?.pdf_url ||
    w.open_access?.oa_url ||
    ''
  ).trim();
  return u || undefined;
}

export function normalizeReportDoi(doi?: string | null): string | undefined {
  const bare = String(doi ?? '')
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  return bare || undefined;
}

export function quartileOf(w: Work, map: Map<string, Quartile>): string {
  return resolveWorkQuartile(w, map) ?? '';
}

export function filterWorksByAuthorshipOrcid(works: Work[], orcidRaw: string): Work[] {
  const target = normOrcid(orcidRaw);
  if (!target) return [];
  return works.filter(
    (w) =>
      !isDatasetWork(w) &&
      (w.authorships || []).some((a) => normOrcid(a.author?.orcid) === target),
  );
}

export function buildObrasFull(
  works: Work[],
  quartileMap?: Map<string, Quartile>,
): ReportObraFullRow[] {
  const map = quartileMap ?? loadQuartileMap(SJR_MAP_PATH);
  return works.map((w) => ({
    anio: workYear(w) ?? '—',
    titulo: stripTags(w.t || w.title || 'Sin título'),
    revista: (w.s || w.pub || '').trim() || '—',
    cuartil: quartileOf(w, map),
    citas: getWorkOpenAlexCitations(w),
    doi: normalizeReportDoi(w.d ?? w.doi),
    url: workLandingUrl(w),
  }));
}
