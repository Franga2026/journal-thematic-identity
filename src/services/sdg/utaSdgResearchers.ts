import type { Researcher } from '../../shared/types';
import { getOA } from '../../utils/dataProcessing';
import { cleanOrcid, getResearcherUtaId } from '../../utils/helpers';
import type { SdgRankedResearcher } from '../../shared/types/sdgResearcher';
import type { SdgRankingDiagnostics } from './sdgRankingDiagnostics';
import { approximateHIndex, computeCollaborationScore, computeSdgScore } from './scoring';

/** Ranking UTA desde openalex.json → sdg_researchers[sdgName] (ORCIDs) */
export function buildUtaRankingFromSdgResearchers(
  sdgName: string,
  sdgNum: number,
  researchers: Researcher[],
  publicationCountByOrcid: Map<string, number>,
  diag: SdgRankingDiagnostics,
  limit = 10
): SdgRankedResearcher[] {
  const orcids = (getOA().sdg_researchers || {})[sdgName] || [];
  if (!orcids.length) return [];

  const now = new Date().toISOString();
  const rows: SdgRankedResearcher[] = [];

  orcids.forEach((rawOrcid) => {
    const orcid = cleanOrcid(rawOrcid);
    const r = researchers.find((x) => cleanOrcid(x.o) === orcid);
    if (!r) return;

    const publications_count = publicationCountByOrcid.get(orcid) || 1;
    const citationsPerWork = Array(publications_count).fill(0);
    const h_index_sdg = approximateHIndex(citationsPerWork);
    const collaboration_score = 0;
    const score = computeSdgScore(publications_count, 0, h_index_sdg, collaboration_score);
    const key = getResearcherUtaId(r) || orcid;

    rows.push({
      id: `${sdgNum}-local-sdg-${key}`,
      sdg_id: sdgNum,
      author_openalex_id: orcid || key,
      author_name: `${r.f || ''} ${r.l || ''}`.trim(),
      orcid: orcid || undefined,
      institution_name: (r.dp || [])[0]?.d || 'Universidad de Tarapacá',
      country_code: 'CL',
      region_scope: 'local',
      publications_count,
      citations_count: 0,
      h_index_sdg,
      collaboration_score,
      score,
      rank: 0,
      last_updated: now,
      uta_researcher_id: getResearcherUtaId(r) || r.id,
    });
  });

  diag.authorsAfterDedupe = rows.length;
  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, limit).map((row, i) => ({ ...row, rank: i + 1 }));
}
