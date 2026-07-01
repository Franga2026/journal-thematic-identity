import type { GlobalProfile } from '../../shared/types/globalProfile';
import type { Work } from '../../shared/types';
import type { SdgRankedResearcher, SdgRegionScope, SdgTopCoauthor } from '../../shared/types/sdgResearcher';

/** Fila cruda en JSON v3 (build-ods-rankings / mock). */
export interface OdsRankingJsonResearcher {
  rank: number;
  name: string;
  openalex_id: string;
  orcid?: string | null;
  country?: string | null;
  institution?: string | null;
  fwci: number;
  publications: number;
  citations_ods: number;
  h_index_ods: number;
  global_profile?: GlobalProfile | null;
  top_coauthors?: SdgTopCoauthor[];
  works?: Work[];
}

interface OdsRankingFileV3 {
  sdg: number;
  format_version: number;
  rankings?: {
    global?: OdsRankingJsonResearcher[];
    iberoamerica?: OdsRankingJsonResearcher[];
  };
}

export interface OdsGlobalRanking {
  global: SdgRankedResearcher[];
  iberoamerica: SdgRankedResearcher[];
}

type OdsRankingSource = 'real' | 'mock' | 'empty';

const EMPTY_RANKING: OdsGlobalRanking = { global: [], iberoamerica: [] };

function mapJsonRow(
  row: OdsRankingJsonResearcher,
  sdgId: number,
  regionScope: Extract<SdgRegionScope, 'global' | 'iberoamerica'>,
): SdgRankedResearcher {
  const authorId = row.openalex_id || `${regionScope}-${row.rank}`;
  return {
    id: authorId,
    sdg_id: sdgId,
    author_openalex_id: row.openalex_id,
    author_name: row.name,
    orcid: row.orcid ?? undefined,
    institution_name: row.institution ?? undefined,
    country_code: row.country ?? undefined,
    region_scope: regionScope,
    publications_count: row.publications,
    citations_count: row.citations_ods,
    h_index_sdg: row.h_index_ods,
    collaboration_score: 0,
    score: row.fwci,
    rank: row.rank,
    last_updated: new Date().toISOString(),
    works: row.works,
    global_profile: row.global_profile ?? undefined,
    top_coauthors: row.top_coauthors,
  };
}

function parseRankingFile(raw: OdsRankingFileV3, sdgId: number): OdsGlobalRanking | null {
  if (!raw.rankings) return null;
  const global = (raw.rankings.global ?? []).map((r) => mapJsonRow(r, sdgId, 'global'));
  const iberoamerica = (raw.rankings.iberoamerica ?? []).map((r) =>
    mapJsonRow(r, sdgId, 'iberoamerica'),
  );
  return { global, iberoamerica };
}

function logRankingSource(sdgId: number, source: OdsRankingSource) {
  const label = source === 'real' ? 'JSON real' : source === 'mock' ? 'mock' : 'vacío';
  console.debug(`[getOdsGlobalRanking] SDG ${sdgId}: fuente ${label}`);
}

/**
 * Rankings ODS precomputados (Global + Iberoamérica).
 * Intenta sdg-{n}.json, luego sdg-{n}.mock.json; si no hay ninguno, devuelve listas vacías.
 */
async function fetchRankingJson(
  sdgId: number,
): Promise<{ raw: OdsRankingFileV3 | null; source: OdsRankingSource }> {
  const candidates: { url: string; source: Exclude<OdsRankingSource, 'empty'> }[] = [
    { url: `/ods-rankings/sdg-${sdgId}.json`, source: 'real' },
    { url: `/ods-rankings/sdg-${sdgId}.mock.json`, source: 'mock' },
  ];

  for (const { url, source } of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const raw = (await res.json()) as OdsRankingFileV3;
      if (raw.format_version < 3 || raw.sdg !== sdgId) continue;
      return { raw, source };
    } catch {
      continue;
    }
  }
  return { raw: null, source: 'empty' };
}

export async function getOdsGlobalRanking(sdgId: number): Promise<OdsGlobalRanking> {
  const { raw, source } = await fetchRankingJson(sdgId);
  logRankingSource(sdgId, source);
  if (!raw) return EMPTY_RANKING;
  return parseRankingFile(raw, sdgId) ?? EMPTY_RANKING;
}
