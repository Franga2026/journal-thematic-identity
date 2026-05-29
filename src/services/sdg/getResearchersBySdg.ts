import type {
  SdgRankedResearcher,
  SdgRegionScope,
  SdgResearchersApiResponse,
} from '../../shared/types/sdgResearcher';
import { getData } from '../../utils/dataProcessing';
import { logOdsPipeline } from '../../utils/odsLogs';
import { normalizeSdgId, normalizeSdgParam, sdgNameFromNum } from '../../utils/sdgNormalize';
import { collectPublicationsForSdg } from '../../utils/sdgWorksSource';
import { aggregateAuthorsFromWorks } from './aggregateAuthors';
import {
  aggregateAuthorsFromLocalWorks,
  buildUtaResearchersRanking,
  UTA_SDG_RANKING_LIMIT,
} from './aggregateLocalWorks';
import { getCachedRanking, setCachedRanking } from './cache';
import { SDG_RANKING_CACHE_TTL_MS } from './constants';
import { sdgLog, sdgWarn } from './diagnostics';
import { fetchAllWorksForSdg } from './openAlexWorksClient';
import { memoryResearcherSdgMetricsStore } from '../../persistence/researcherSdgMetricsStore';
import { SdgRankingDiagnostics, type SdgEmptyReason } from './sdgRankingDiagnostics';

const TOP_N = 10;

export { normalizeSdgId } from '../../utils/sdgNormalize';

function toRankedRows(
  partial: Omit<SdgRankedResearcher, 'rank' | 'last_updated'>[],
  limit: number
): SdgRankedResearcher[] {
  const now = new Date().toISOString();
  return partial.slice(0, limit).map((row, i) => ({
    ...row,
    rank: i + 1,
    last_updated: now,
  }));
}

function emptyReasonMessage(reason: SdgEmptyReason, sdgName: string, scope: SdgRegionScope): string {
  switch (reason) {
    case 'no_publications':
      return `No hay publicaciones con etiqueta ODS «${sdgName}» en all-works.json. El total del encabezado puede venir solo de OpenAlex institucional.`;
    case 'no_authorships':
      return 'Hay publicaciones ODS en all-works pero sin authorships, autores (a[]) ni autores_uta vinculados.';
    case 'authors_filtered_out':
      return scope === 'iberoamerica'
        ? 'Hay autores en las publicaciones, pero ninguno pasó el filtro iberoamericano.'
        : 'Hay autores en las publicaciones, pero el filtro del ámbito no dejó candidatos.';
    case 'openalex_fallback_failed':
      return 'No se pudo completar el ranking ni desde publicaciones locales ni desde OpenAlex.';
    default:
      return '';
  }
}

async function rankFromLocalWorks(
  sdgId: number,
  sdgName: string,
  regionScope: SdgRegionScope,
  diag: SdgRankingDiagnostics
): Promise<{ researchers: SdgRankedResearcher[]; emptyReason: SdgEmptyReason }> {
  const works = collectPublicationsForSdg(sdgName, sdgId);
  const data = getData();
  diag.totalPublications = works.length;
  diag.source = 'local';

  if (works.length === 0) {
    diag.emptyReason = 'no_publications';
    return { researchers: [], emptyReason: 'no_publications' };
  }

  if (regionScope === 'local') {
    const researchers = buildUtaResearchersRanking(
      works,
      data,
      sdgName,
      sdgId,
      diag,
      UTA_SDG_RANKING_LIMIT
    );
    if (import.meta.env?.DEV) {
      console.log('[sdg-ranking] after UTA filter:', researchers.length);
    }
    if (researchers.length === 0) {
      diag.emptyReason = 'no_authorships';
      return {
        researchers: [],
        emptyReason: 'no_authorships',
      };
    }
    diag.emptyReason = 'ok';
    return { researchers, emptyReason: 'ok' };
  }

  const partial = aggregateAuthorsFromLocalWorks(works, data, sdgId, sdgName, regionScope, diag);
  if (import.meta.env?.DEV) {
    const label = regionScope === 'iberoamerica' ? 'after Ibero filter' : 'global authors';
    console.log(`[sdg-ranking] ${label}:`, partial.length);
  }

  if (partial.length === 0) {
    diag.emptyReason =
      diag.authorshipsExtracted === 0 ? 'no_authorships' : 'authors_filtered_out';
    return { researchers: [], emptyReason: diag.emptyReason };
  }

  diag.emptyReason = 'ok';
  return { researchers: toRankedRows(partial, TOP_N), emptyReason: 'ok' };
}

async function rankFromOpenAlexFallback(
  sdgId: number,
  regionScope: SdgRegionScope,
  diag: SdgRankingDiagnostics
): Promise<SdgRankedResearcher[]> {
  diag.source = 'openalex';
  sdgLog('OpenAlex fallback', { sdgId, regionScope });
  const { works, diagnostics } = await fetchAllWorksForSdg(sdgId);
  diagnostics.forEach((d) => sdgWarn(d));
  const partial = aggregateAuthorsFromWorks(works, sdgId, regionScope);
  diag.totalPublications = works.length;
  diag.authorsAfterDedupe = partial.length;
  diag.authorsAfterRegionFilter = partial.length;
  return toRankedRows(partial, TOP_N);
}

export async function getResearchersBySdg(
  sdgIdInput: number | string,
  regionScope: SdgRegionScope,
  options?: { skipCache?: boolean; ttlMs?: number }
): Promise<SdgResearchersApiResponse> {
  const sdgId = normalizeSdgId(sdgIdInput);
  const ttl = options?.ttlMs ?? SDG_RANKING_CACHE_TTL_MS;
  const sdgName = sdgNameFromNum(sdgId);
  if (!sdgName) {
    throw new Error(`ODS inválido: ${sdgId}`);
  }

  const diag = new SdgRankingDiagnostics(sdgId, sdgName, regionScope);

  if (!options?.skipCache) {
    const cached = getCachedRanking(sdgId, regionScope, ttl);
    if (cached && cached.rows.length > 0) {
      return {
        sdg_id: sdgId,
        sdg_name: sdgName,
        region_scope: regionScope,
        total_works_fetched: cached.meta.totalWorksFetched,
        researchers: cached.rows,
        cached: true,
        empty_reason: 'ok',
        diagnostics: [...cached.meta.diagnostics, 'served_from_memory_cache'],
      };
    }
  }

  let researchers: SdgRankedResearcher[] = [];
  let emptyReason: SdgEmptyReason = 'ok';
  let emptyMessage: string | undefined;
  const diagnostics: string[] = [];

  try {
    const local = await rankFromLocalWorks(sdgId, sdgName, regionScope, diag);
    researchers = local.researchers;
    emptyReason = local.emptyReason;
    emptyMessage =
      emptyReason === 'no_authorships'
        ? `Hay ${diag.totalPublications} publicaciones ODS en all-works pero ninguna con autores vinculados (authorships / a[] / autores_uta). Ejecute npm run link:works.`
        : emptyReasonMessage(emptyReason, sdgName, regionScope);

    if (researchers.length === 0 && regionScope !== 'local') {
      diagnostics.push('openalex_fallback_start');
      try {
        researchers = await rankFromOpenAlexFallback(sdgId, regionScope, diag);
        if (researchers.length > 0) {
          emptyReason = 'ok';
          emptyMessage = undefined;
        } else if (emptyReason === 'no_publications' || emptyReason === 'authors_filtered_out') {
          emptyReason = researchers.length === 0 ? emptyReason : 'ok';
          emptyMessage = emptyReasonMessage(
            emptyReason === 'no_publications' ? 'no_publications' : 'authors_filtered_out',
            sdgName,
            regionScope
          );
        }
      } catch (err) {
        if (emptyReason === 'no_publications' || researchers.length === 0) {
          emptyReason = 'openalex_fallback_failed';
          emptyMessage = err instanceof Error ? err.message : 'Error OpenAlex';
        }
        sdgWarn('Fallback OpenAlex falló', err);
      }
    }
  } catch (err) {
    diag.flush();
    throw err;
  }

  diag.emptyReason = emptyReason;
  diagnostics.push(...diag.toLines());

  if (researchers.length > 0) {
    setCachedRanking(
      sdgId,
      regionScope,
      researchers,
      {
        totalWorksFetched: diag.totalPublications,
        diagnostics,
        emptyReason,
        emptyMessage,
      },
      ttl
    );
    await memoryResearcherSdgMetricsStore.save(sdgId, regionScope, researchers);
  }

  return {
    sdg_id: sdgId,
    sdg_name: sdgName,
    region_scope: regionScope,
    total_works_fetched: diag.totalPublications,
    researchers,
    cached: false,
    empty_reason: emptyReason,
    empty_message: researchers.length ? undefined : emptyMessage,
    diagnostics,
  };
}

/** Carga los 3 rankings y emite logs [ODS] consolidados (solo DEV). */
export async function getAllOdsRankings(sdgIdInput: number | string): Promise<{
  local: SdgResearchersApiResponse;
  ibero: SdgResearchersApiResponse;
  global: SdgResearchersApiResponse;
}> {
  const sdgId = normalizeSdgId(sdgIdInput);
  const normalizedSdg = normalizeSdgParam(sdgId);
  const [local, ibero, global] = await Promise.all([
    getResearchersBySdg(sdgId, 'local', { skipCache: true }),
    getResearchersBySdg(sdgId, 'iberoamerica', { skipCache: true }),
    getResearchersBySdg(sdgId, 'global', { skipCache: true }),
  ]);

  logOdsPipeline({
    sdgNum: sdgId,
    normalizedSdg,
    publications: collectPublicationsForSdg(local.sdg_name, sdgId),
    utaAuthors: local.researchers.length,
    iberoAuthors: ibero.researchers.length,
    globalAuthors: global.researchers.length,
  });

  return { local, ibero, global };
}

export type { SdgRegionScope };
