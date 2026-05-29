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

/** Mapeo estándar /authors?search=… (Top 10 Global / Iberoamérica) */
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
 * Top 10 por ODS: /authors?search={nombre ODS en inglés}&filter=has_orcid:true
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
    topics: (row.x_concepts || []).slice(0, 8).map((c) => c.display_name).filter(Boolean) as string[],
  };
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
