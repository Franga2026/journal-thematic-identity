import type { Researcher, Work } from '../shared/types';
import type {
  OpenAlexAuthorDetail,
  OpenAlexAuthorSummary,
  OpenAlexAuthorsResponse,
} from '../shared/types/openalex';
import { getAW, getData } from '../utils/dataProcessing';
import { extractOrcidFromOpenAlex } from '../utils/researcherProfile';
import {
  IBEROAMERICA_COUNTRY_CODES,
  SDG_NAME_TO_NUMBER,
  SDG_NUMBER_TO_NAME,
} from '../utils/constants';
import { buildUtaResearchersForSdg, filterWorksBySdg, type UtaResearcherSdgRow } from '../utils/odsResearchers';

export { getResearchersBySdg, normalizeSdgId } from './sdg/getResearchersBySdg';

const OPENALEX_BASE = 'https://api.openalex.org';
const MAILTO = 'directorio.uta@tarapaca.cl';

export function sdgNameToNumber(name: string): number | undefined {
  return SDG_NAME_TO_NUMBER[name as keyof typeof SDG_NAME_TO_NUMBER];
}

export function sdgNumberToName(num: number): string | undefined {
  return SDG_NUMBER_TO_NAME[String(num)];
}

export function parseOpenAlexAuthorId(idOrUrl: string): string {
  const raw = idOrUrl.trim();
  const match = raw.match(/([A-Z]\d+)$/i);
  return match ? match[1].toUpperCase() : raw.replace(/^https?:\/\/openalex\.org\//i, '');
}

/** Mapeo estándar /authors?search=… (Top 25 Global / Iberoamérica en rankings persistidos) */
function mapAuthorFromSearchEndpoint(
  row: OpenAlexAuthorsResponse['results'][0]
): OpenAlexAuthorSummary {
  const openAlexId = row.id.replace('https://openalex.org/', '');
  const orcid = row.orcid ? row.orcid.replace('https://orcid.org/', '') : undefined;
  const inst = row.last_known_institutions?.[0];
  return {
    id: openAlexId,
    openAlexId,
    display_name: row.display_name || 'Sin nombre',
    works_count: row.works_count ?? 0,
    cited_by_count: row.cited_by_count ?? 0,
    orcid,
    h_index: row.summary_stats?.h_index,
    institution: inst?.display_name,
    country_code: inst?.country_code,
  };
}

function mapAuthorFromAuthorsEndpoint(
  row: OpenAlexAuthorsResponse['results'][0]
): OpenAlexAuthorSummary {
  const mapped = mapAuthorFromSearchEndpoint(row);
  return {
    ...mapped,
    id: row.id,
    openAlexId: parseOpenAlexAuthorId(row.id),
    orcid: extractOrcidFromOpenAlex(row.orcid) || mapped.orcid,
  };
}

async function openAlexFetchUrl<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`OpenAlex ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function openAlexFetch<T>(path: string): Promise<T> {
  const url = `${OPENALEX_BASE}${path}${path.includes('?') ? '&' : '?'}mailto=${encodeURIComponent(MAILTO)}`;
  return openAlexFetchUrl<T>(url);
}

export function normalizeSdgNumber(sdgNumber: number | string | undefined): number {
  const n = typeof sdgNumber === 'string' ? parseInt(sdgNumber, 10) : Math.floor(Number(sdgNumber));
  if (!Number.isFinite(n) || n < 1 || n > 17) {
    throw new Error(`Número de ODS inválido: ${String(sdgNumber)}`);
  }
  return n;
}

export type OdsAuthorScope = 'ibero' | 'global';

/**
 * Top 25 por ODS (legacy search): /authors?search={nombre ODS en inglés}&filter=has_orcid:true
 */
export function buildTopAuthorsByOdsNameUrl(odsName: string, scope: OdsAuthorScope): string {
  const search = encodeURIComponent(odsName.trim());
  let filter = 'has_orcid:true';
  if (scope === 'ibero') {
    filter += `,last_known_institutions.country_code:${IBEROAMERICA_COUNTRY_CODES}`;
  }
  return `${OPENALEX_BASE}/authors?search=${search}&filter=${filter}&sort=works_count:desc&per_page=10&mailto=${encodeURIComponent(MAILTO)}`;
}

/** @deprecated Use buildTopAuthorsByOdsNameUrl con el nombre en inglés del ODS */
export function buildTopAuthorsBySdgUrl(
  sdgNumber: number | string | undefined,
  scope: OdsAuthorScope
): string {
  const name = sdgNumberToName(normalizeSdgNumber(sdgNumber));
  if (!name) {
    throw new Error(`Nombre de ODS no encontrado para ${String(sdgNumber)}`);
  }
  return buildTopAuthorsByOdsNameUrl(name, scope);
}

export const buildAuthorsBySdgUrl = buildTopAuthorsBySdgUrl;

/** @deprecated Usar getResearchersBySdg / api/sdgResearchersApi (flujo obras → autores) */
export async function fetchTopAuthorsByOdsName(
  odsName: string,
  scope: OdsAuthorScope
): Promise<OpenAlexAuthorSummary[]> {
  const { getResearchersBySdg } = await import('./sdg/getResearchersBySdg');
  const num = sdgNameToNumber(odsName);
  if (!num) throw new Error(`Nombre de ODS no reconocido: ${odsName}`);
  const regionScope = scope === 'ibero' ? 'iberoamerica' : 'global';
  const res = await getResearchersBySdg(num, regionScope);
  return res.researchers.map((r) => ({
    id: r.author_openalex_id,
    openAlexId: r.author_openalex_id,
    display_name: r.author_name,
    orcid: r.orcid,
    works_count: r.publications_count,
    cited_by_count: r.citations_count,
    h_index: r.h_index_sdg,
    institution: r.institution_name,
    country_code: r.country_code,
  }));
}

/** @deprecated Usar getResearchersBySdg */
export async function fetchTopAuthorsBySdg(
  sdgNumber: number | string | undefined,
  scope: OdsAuthorScope
): Promise<OpenAlexAuthorSummary[]> {
  const name = sdgNumberToName(normalizeSdgNumber(sdgNumber));
  if (!name) {
    throw new Error(`Nombre de ODS no encontrado para ${String(sdgNumber)}`);
  }
  return fetchTopAuthorsByOdsName(name, scope);
}

/** Extrae nombres de temas: usa `topics` (nuevo) y cae a `x_concepts` (legacy, en retirada). */
function extractTopicNames(row: { topics?: unknown; x_concepts?: unknown }): string[] {
  const pick = (arr: unknown): string[] =>
    Array.isArray(arr)
      ? arr
          .map((t) =>
            t && typeof t === 'object' ? (t as { display_name?: string }).display_name : undefined
          )
          .filter((x): x is string => !!x)
      : [];
  const fromTopics = pick(row.topics);
  if (fromTopics.length) return fromTopics.slice(0, 8);
  return pick(row.x_concepts).slice(0, 8);
}

/** Perfil OpenAlex por ORCID (0000-…) o ID de autor (A…) */
export async function fetchOpenAlexAuthor(authorIdOrOrcid: string): Promise<OpenAlexAuthorDetail> {
  const raw = authorIdOrOrcid.trim();
  let path: string;
  if (raw.startsWith('http')) {
    path = `/authors/${encodeURIComponent(raw)}`;
  } else if (/^A\d+$/i.test(raw)) {
    path = `/authors/${raw.toUpperCase()}`;
  } else {
    const orcid = extractOrcidFromOpenAlex(raw) || raw;
    path = `/authors/https://orcid.org/${orcid}`;
  }
  const row = await openAlexFetch<OpenAlexAuthorsResponse['results'][0]>(path);
  const base = mapAuthorFromAuthorsEndpoint(row);
  return {
    ...base,
    orcid: extractOrcidFromOpenAlex(row.orcid) || base.orcid,
    topics: extractTopicNames(row as { topics?: unknown; x_concepts?: unknown }),
  };
}

/** Normaliza un nombre: quita acentos, minúsculas, solo letras y espacios. */
function normalizeName(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fallback: busca el perfil canónico por NOMBRE cuando el id de autor está
 * fusionado y no hay ORCID. Prefiere coincidencias que compartan el apellido y,
 * entre ellas, la de mayor cantidad de obras (suele ser el perfil principal).
 */
export async function fetchOpenAlexAuthorByName(name: string): Promise<OpenAlexAuthorDetail | null> {
  const q = (name || '').trim();
  if (!q) return null;

  const data = await openAlexFetch<OpenAlexAuthorsResponse>(
    `/authors?search=${encodeURIComponent(q)}&per_page=5`
  );
  const results = data.results || [];
  if (!results.length) return null;

  const qSurname = normalizeName(q).split(' ').filter(Boolean).pop() || '';
  const matches = results.filter((r) => {
    const rn = normalizeName(r.display_name || '');
    return qSurname.length >= 3 && rn.includes(qSurname);
  });
  const pool = matches.length ? matches : results;
  const best = pool.slice().sort((a, b) => (b.works_count || 0) - (a.works_count || 0))[0];
  if (!best) return null;

  const baseDetail = mapAuthorFromSearchEndpoint(best);
  return {
    ...baseDetail,
    topics: extractTopicNames(best as { topics?: unknown; x_concepts?: unknown }),
  };
}


/**
 * FWCI (Field-Weighted Citation Impact) calculado sobre OpenAlex como universo
 * de referencia (NO Scopus/SciVal). Promedio de los `fwci` por obra que entrega
 * OpenAlex (cada uno = citas reales / citas esperadas del mismo año + tipo + campo).
 * Se excluyen las obras con `fwci = null` (OpenAlex no pudo normalizarlas, p. ej.
 * del año en curso); las obras con `fwci = 0` SÍ cuentan. 1,00 = promedio mundial.
 */
export async function fetchAuthorFwci(input: {
  orcid?: string;
  oaId?: string;
  maxPages?: number;
}): Promise<{ fwci: number | null; works: number }> {
  const orcid = (input.orcid || '').replace(/^https?:\/\/orcid\.org\//i, '').trim();
  const oaId = (input.oaId || '').replace(/^https?:\/\/openalex\.org\//i, '').trim();
  const maxPages = input.maxPages ?? 5;

  let filter: string;
  if (orcid) {
    filter = `authorships.author.orcid:https://orcid.org/${orcid}`;
  } else if (oaId) {
    filter = `authorships.author.id:https://openalex.org/${oaId}`;
  } else {
    return { fwci: null, works: 0 };
  }

  let cursor = '*';
  let sum = 0;
  let count = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const path = `/works?filter=${filter}&select=fwci&per-page=200&cursor=${encodeURIComponent(cursor)}`;
    const data = await openAlexFetch<{
      results?: Array<{ fwci?: number | null }>;
      meta?: { next_cursor?: string };
    }>(path);
    const results = data.results || [];
    for (const r of results) {
      if (typeof r.fwci === 'number') {
        sum += r.fwci;
        count += 1;
      }
    }
    const next = data.meta?.next_cursor;
    if (!next || !results.length) break;
    cursor = next;
  }

  return { fwci: count > 0 ? sum / count : null, works: count };
}

export interface OpenAlexWorkItem {
  id: string;
  title: string;
  year: number | null;
  venue: string | null;
  citedByCount: number;
  fwci: number | null;
  doiUrl: string | null;
  isOpenAccess: boolean;
  authors: string[];
  volume: string | null;
  issue: string | null;
  pages: string | null;
  docType: string | null;
}

/**
 * Producción científica de un autor desde OpenAlex, paginada y ordenada por año
 * (reciente -> antiguo). Trae además autores/volumen/número/páginas/tipo para
 * poder generar citas (APA, IEEE, Vancouver, BibTeX, RIS) reutilizando el sistema
 * de citas del portal.
 */
export async function fetchAuthorWorks(input: {
  orcid?: string;
  oaId?: string;
  page?: number;
  perPage?: number;
}): Promise<{ works: OpenAlexWorkItem[]; total: number }> {
  const orcid = (input.orcid || '').replace(/^https?:\/\/orcid\.org\//i, '').trim();
  const oaId = (input.oaId || '').replace(/^https?:\/\/openalex\.org\//i, '').trim();
  const page = Math.max(1, input.page ?? 1);
  const perPage = input.perPage ?? 25;

  let filter: string;
  if (orcid) {
    filter = `authorships.author.orcid:https://orcid.org/${orcid}`;
  } else if (oaId) {
    filter = `authorships.author.id:https://openalex.org/${oaId}`;
  } else {
    return { works: [], total: 0 };
  }

  const select =
    'id,title,publication_year,cited_by_count,fwci,doi,open_access,primary_location,authorships,biblio,type';
  const path = `/works?filter=${filter}&select=${select}&sort=publication_year:desc&per-page=${perPage}&page=${page}`;

  const data = await openAlexFetch<{
    results?: Array<{
      id?: string;
      title?: string | null;
      publication_year?: number | null;
      cited_by_count?: number | null;
      fwci?: number | null;
      doi?: string | null;
      type?: string | null;
      open_access?: { is_oa?: boolean } | null;
      primary_location?: { source?: { display_name?: string } | null } | null;
      authorships?: Array<{
        author?: { display_name?: string } | null;
        raw_author_name?: string | null;
      } | null>;
      biblio?: {
        volume?: string | null;
        issue?: string | null;
        first_page?: string | null;
        last_page?: string | null;
      } | null;
    }>;
    meta?: { count?: number };
  }>(path);

  const works: OpenAlexWorkItem[] = (data.results || []).map((r) => {
    const authors = (r.authorships || [])
      .map((a) => a?.author?.display_name || a?.raw_author_name || '')
      .filter(Boolean) as string[];
    const fp = r.biblio?.first_page || '';
    const lp = r.biblio?.last_page || '';
    const pages = fp && lp ? `${fp}-${lp}` : fp || lp || null;
    return {
      id: (r.id || '').replace(/^https?:\/\/openalex\.org\//i, ''),
      title: r.title || '(sin titulo)',
      year: r.publication_year ?? null,
      venue: r.primary_location?.source?.display_name || null,
      citedByCount: r.cited_by_count ?? 0,
      fwci: typeof r.fwci === 'number' ? r.fwci : null,
      doiUrl: r.doi || null,
      isOpenAccess: !!r.open_access?.is_oa,
      authors,
      volume: r.biblio?.volume || null,
      issue: r.biblio?.issue || null,
      pages,
      docType: r.type || null,
    };
  });

  return { works, total: data.meta?.count ?? works.length };
}

export function getUtaResearchersForSdg(
  sdgName: string,
  works: Work[] = getAW(),
  data: Researcher[] = getData()
): UtaResearcherSdgRow[] {
  return buildUtaResearchersForSdg(works, data, sdgName);
}

export function getSdgPublicationCount(
  sdgName: string,
  works: Work[] = getAW(),
  sdgNum?: number
): number {
  return filterWorksBySdg(works, sdgName, sdgNum).length;
}
