import type { Work } from '../shared/types';

type WorkLike = Work & {
  title?: string;
  cited_by_count?: number;
  doi?: string;
  doi_url?: string;
  url?: string;
  pdf_url?: string;
  openalex_id?: string;
  open_access?: { oa_url?: string; is_oa?: boolean };
  primary_location?: { pdf_url?: string; landing_page_url?: string };
};

function normDoi(d?: string): string {
  const raw = (d || '').toLowerCase().trim();
  if (!raw) return '';
  return raw.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
}

function normTitle(w: WorkLike): string {
  return ((w.t || w.title || '').replace(/<[^>]*>/g, '') || '').toLowerCase().trim();
}

function parseOpenAlexId(id?: string): string {
  if (!id) return '';
  return id.replace('https://openalex.org/', '').trim();
}

/** Normaliza alias comunes (title → t, cited_by_count → c). */
export function normalizeWorkFields(work: WorkLike | null | undefined): Work {
  if (!work) return {};
  const w = { ...work } as WorkLike;
  if (!w.t && w.title) w.t = w.title;
  if (w.c == null && w.cited_by_count != null) w.c = w.cited_by_count;
  if (!w.d && w.doi) w.d = w.doi;
  if (!w.u && w.url) w.u = w.url;
  if (w.oa == null && w.open_access?.is_oa != null) w.oa = w.open_access.is_oa;
  if (!w.ou && w.open_access?.oa_url) w.ou = w.open_access.oa_url;
  if (!w.ou && w.primary_location?.pdf_url) w.ou = w.primary_location.pdf_url;
  if (!w.u && w.primary_location?.landing_page_url) w.u = w.primary_location.landing_page_url;
  if (!w.u && w.pdf_url) w.u = w.pdf_url;
  return w as Work;
}

/** URL de acceso a la publicación (DOI, OA, PDF, OpenAlex, etc.). */
export function getWorkAccessUrl(work: WorkLike | null | undefined): string | null {
  const w = normalizeWorkFields(work);
  const oaUrl = w.open_access?.oa_url || w.ou || '';
  const pdfUrl = w.primary_location?.pdf_url || w.pdf_url || '';
  const landingUrl = w.primary_location?.landing_page_url || '';
  const rawUrl = w.u || w.url || w.doi_url || '';
  const doiRaw = w.d || w.doi || '';
  const doiUrl = doiRaw
    ? doiRaw.startsWith('http')
      ? doiRaw
      : `https://doi.org/${normDoi(doiRaw)}`
    : '';
  const openAlexId = parseOpenAlexId(w.openalex_id);
  const openAlexUrl = openAlexId ? `https://openalex.org/${openAlexId}` : '';

  return (
    oaUrl ||
    pdfUrl ||
    landingUrl ||
    rawUrl ||
    doiUrl ||
    openAlexUrl ||
    null
  );
}

function workMatchKey(w: WorkLike): string {
  const doi = normDoi(w.d || w.doi);
  if (doi) return `doi:${doi}`;
  const title = normTitle(w);
  return title ? `title:${title}` : '';
}

/** Completa metadatos de enlace desde otras fuentes (p. ej. catálogo OpenAlex del coautor). */
export function mergeWorkLinkMetadata(base: Work, ...sources: Array<Work | null | undefined>): Work {
  const merged = normalizeWorkFields(base) as WorkLike;

  sources.filter(Boolean).forEach((src) => {
    const s = normalizeWorkFields(src!) as WorkLike;
    if (!merged.t && s.t) merged.t = s.t;
    if (merged.y == null && s.y != null) merged.y = s.y;
    if (merged.c == null && s.c != null) merged.c = s.c;
    if (!merged.s && s.s) merged.s = s.s;
    if (!merged.d && s.d) merged.d = s.d;
    if (!merged.ou && s.ou) merged.ou = s.ou;
    if (!merged.u && s.u) merged.u = s.u;
    if (merged.oa == null && s.oa != null) merged.oa = s.oa;
    if (!merged.field && s.field) merged.field = s.field;
    if (!merged.openalex_id && s.openalex_id) merged.openalex_id = s.openalex_id;
    if (!merged.pdf_url && s.pdf_url) merged.pdf_url = s.pdf_url;
    if (!merged.open_access && s.open_access) merged.open_access = s.open_access;
    if (!merged.primary_location && s.primary_location) merged.primary_location = s.primary_location;
    if (!merged.a?.length && s.a?.length) merged.a = s.a;
  });

  return merged as Work;
}

/** Enriquece obras locales con URLs del catálogo global cuando coinciden por DOI/título. */
export function mergeWorksWithCatalog(localWorks: Work[], catalog: Work[] = []): Work[] {
  if (!catalog.length) return localWorks.map((w) => normalizeWorkFields(w));

  const byDoi = new Map<string, Work>();
  const byTitle = new Map<string, Work>();
  catalog.forEach((raw) => {
    const item = normalizeWorkFields(raw);
    const doiKey = normDoi(item.d);
    if (doiKey) byDoi.set(doiKey, item);
    const titleKey = normTitle(item);
    if (titleKey) byTitle.set(titleKey, item);
  });

  return localWorks.map((local) => {
    const normalized = normalizeWorkFields(local);
    const doiKey = normDoi(normalized.d);
    const titleKey = normTitle(normalized);
    const match = (doiKey && byDoi.get(doiKey)) || (titleKey && byTitle.get(titleKey));
    return mergeWorkLinkMetadata(normalized, match);
  });
}

export function getWorkScholarSearchUrl(work: WorkLike | null | undefined): string | null {
  const w = normalizeWorkFields(work);
  const title = (w.t || '').replace(/<[^>]*>/g, '').trim();
  if (!title || title === 'Sin título') return null;
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`;
}

/** URL final para UI: acceso directo o búsqueda Scholar como último recurso. */
export function getWorkNavigationUrl(work: WorkLike | null | undefined): string | null {
  return getWorkAccessUrl(work) || getWorkScholarSearchUrl(work);
}

export { normDoi, normTitle };
