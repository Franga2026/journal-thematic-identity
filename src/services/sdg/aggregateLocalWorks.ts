import type { Researcher, Work } from '../../shared/types';
import type { SdgRankedResearcher, SdgRegionScope } from '../../shared/types/sdgResearcher';
import { cleanOrcid, getResearcherUtaId, normalizeAuthorName } from '../../utils/helpers';
import { isUTAInstitution } from '../../utils/institutionMatch';
import { filterWorksBySdg } from '../../utils/odsResearchers';
import { collectPublicationsForSdg } from '../../utils/sdgWorksSource';
import { IBEROAMERICA_COUNTRY_SET } from './constants';
import { buildResearcherIndex, scanLocalWorksAuthorships } from './extractLocalAuthorships';
import type { SdgRankingDiagnostics } from './sdgRankingDiagnostics';
import { approximateHIndex, computeCollaborationScore, computeSdgScore } from './scoring';
import { sortSdgRowsByPerfilesOrder } from '../../utils/perfilesOrder';
import { buildUtaRankingFromSdgResearchers } from './utaSdgResearchers';

/** Sin tope: listar todos los investigadores UTA con publicaciones en el ODS. */
export const UTA_SDG_RANKING_LIMIT = Number.MAX_SAFE_INTEGER;

interface AuthorAcc {
  authorKey: string;
  authorName: string;
  orcid?: string;
  institutionName?: string;
  institutionOpenalexId?: string;
  countryCodes: Set<string>;
  isUtaLinked: boolean;
  utaResearcherId?: string;
  citationsPerWork: number[];
  multiCountryWorkCount: number;
}

function passesRegionFilter(acc: AuthorAcc, scope: SdgRegionScope): boolean {
  if (scope === 'global') return true;

  const countries = [...acc.countryCodes];

  if (scope === 'local') {
    if (acc.isUtaLinked) return true;
    if (acc.institutionName && isUTAInstitution(acc.institutionName)) return true;
    return false;
  }

  if (scope === 'iberoamerica') {
    if (countries.some((c) => IBEROAMERICA_COUNTRY_SET.has(c))) return true;
    if (acc.isUtaLinked) return true;
    return false;
  }

  return false;
}

function pickPrimaryCountry(acc: AuthorAcc): string | undefined {
  const counts = new Map<string, number>();
  acc.countryCodes.forEach((c) => counts.set(c, (counts.get(c) || 0) + 1));
  let best: string | undefined;
  let bestN = 0;
  counts.forEach((n, c) => {
    if (n > bestN) {
      bestN = n;
      best = c;
    }
  });
  if (best) return best;
  if (acc.isUtaLinked) return 'CL';
  return undefined;
}

export function aggregateAuthorsFromLocalWorks(
  works: Work[],
  researchers: Researcher[],
  sdgId: number,
  sdgName: string,
  scope: SdgRegionScope,
  diag: SdgRankingDiagnostics
): Omit<SdgRankedResearcher, 'rank' | 'last_updated'>[] {
  const index = buildResearcherIndex(researchers);
  const byAuthor = new Map<string, AuthorAcc>();

  const perWorkAuthorships = scanLocalWorksAuthorships(works, index, diag);

  perWorkAuthorships.forEach((authorships, workIndex) => {
    const work = works[workIndex];
    const citations = work.c ?? 0;
    const workCountries = new Set<string>();
    authorships.forEach((a) => a.countryCodes.forEach((c) => workCountries.add(c)));
    const isMultiCountry = workCountries.size > 1;

    diag.authorshipsExtracted += authorships.length;

    authorships.forEach((auth) => {
      if (auth.institutionName && isUTAInstitution(auth.institutionName)) {
        auth.isUtaLinked = true;
        if (!auth.countryCodes.length) auth.countryCodes.push('CL');
      }

      let acc = byAuthor.get(auth.authorKey);
      if (!acc) {
        acc = {
          authorKey: auth.authorKey,
          authorName: auth.authorName,
          orcid: auth.orcid,
          institutionName: auth.institutionName,
          institutionOpenalexId: auth.institutionOpenalexId,
          countryCodes: new Set(auth.countryCodes),
          isUtaLinked: auth.isUtaLinked,
          utaResearcherId: auth.utaResearcherId,
          citationsPerWork: [],
          multiCountryWorkCount: 0,
        };
        byAuthor.set(auth.authorKey, acc);
      }

      acc.authorName = auth.authorName || acc.authorName;
      if (auth.orcid) acc.orcid = auth.orcid;
      if (auth.institutionName) acc.institutionName = auth.institutionName;
      auth.countryCodes.forEach((c) => acc!.countryCodes.add(c));
      acc.isUtaLinked = acc.isUtaLinked || auth.isUtaLinked;
      if (auth.utaResearcherId) acc.utaResearcherId = auth.utaResearcherId;

      acc.citationsPerWork.push(citations);
      if (isMultiCountry) acc.multiCountryWorkCount += 1;
    });
  });

  diag.authorsAfterDedupe = byAuthor.size;

  const rows: Omit<SdgRankedResearcher, 'rank' | 'last_updated'>[] = [];

  byAuthor.forEach((acc) => {
    if (!passesRegionFilter(acc, scope)) return;

    const publications_count = acc.citationsPerWork.length;
    if (publications_count === 0) return;

    const citations_count = acc.citationsPerWork.reduce((s, c) => s + c, 0);
    const h_index_sdg = approximateHIndex(acc.citationsPerWork);
    const collaboration_score = computeCollaborationScore(
      acc.multiCountryWorkCount,
      publications_count
    );
    const score = computeSdgScore(
      publications_count,
      citations_count,
      h_index_sdg,
      collaboration_score
    );

    rows.push({
      id: `${sdgId}-${scope}-${acc.authorKey}`,
      sdg_id: sdgId,
      author_openalex_id: acc.authorKey,
      author_name: acc.authorName,
      orcid: acc.orcid,
      institution_name: acc.institutionName,
      country_code: pickPrimaryCountry(acc),
      institution_openalex_id: acc.institutionOpenalexId,
      region_scope: scope,
      publications_count,
      citations_count,
      h_index_sdg,
      collaboration_score,
      score,
      uta_researcher_id: scope === 'local' ? acc.utaResearcherId : undefined,
    });
  });

  diag.authorsAfterRegionFilter = rows.length;
  rows.sort((a, b) => b.score - a.score || b.citations_count - a.citations_count);
  return rows;
}

function workLinkedToResearcher(work: Work, r: Researcher): boolean {
  const utaId = getResearcherUtaId(r);
  const orcid = cleanOrcid(r.o);
  const linked = work.autores_uta || [];
  if (linked.includes(utaId) || (orcid && linked.includes(orcid))) return true;

  const full = normalizeAuthorName(`${r.f || ''} ${r.l || ''}`);
  return (work.a || []).some((name) => normalizeAuthorName(name) === full);
}

/** Ranking UTA desde all-works: autores_uta, a[] y sdg_researchers */
export function buildUtaResearchersRanking(
  works: Work[],
  researchers: Researcher[],
  sdgName: string,
  sdgId: number,
  diag: SdgRankingDiagnostics,
  limit = UTA_SDG_RANKING_LIMIT
): SdgRankedResearcher[] {
  let sdgWorks = collectPublicationsForSdg(sdgName, sdgId);
  if (!sdgWorks.length && works.length) {
    sdgWorks = filterWorksBySdg(works, sdgName, sdgId);
  }
  diag.totalPublications = sdgWorks.length;
  if (sdgWorks[0]) diag.samplePublication = sdgWorks[0];

  const pubByOrcid = new Map<string, number>();
  sdgWorks.forEach((w) => {
    (w.autores_uta || []).forEach((id) => {
      const o = cleanOrcid(id);
      if (o) pubByOrcid.set(o, (pubByOrcid.get(o) || 0) + 1);
    });
  });

  const now = new Date().toISOString();
  const rows: SdgRankedResearcher[] = [];
  const seen = new Set<string>();

  researchers.forEach((r) => {
    const pubs = sdgWorks.filter((w) => workLinkedToResearcher(w, r));
    if (!pubs.length) return;

    const key = getResearcherUtaId(r) || r.id || cleanOrcid(r.o) || `${r.f}-${r.l}`;
    if (seen.has(key)) return;
    seen.add(key);

    const citationsPerWork = pubs.map((w) => w.c ?? 0);
    const publications_count = pubs.length;
    const citations_count = citationsPerWork.reduce((s, c) => s + c, 0);
    const h_index_sdg = approximateHIndex(citationsPerWork);
    const multiCountry = pubs.filter((w) => (w.autores_uta || []).length > 1).length;
    const collaboration_score = computeCollaborationScore(multiCountry, publications_count);
    const score = computeSdgScore(
      publications_count,
      citations_count,
      h_index_sdg,
      collaboration_score
    );

    rows.push({
      id: `${sdgId}-local-${key}`,
      sdg_id: sdgId,
      author_openalex_id: cleanOrcid(r.o) || r.id || key,
      author_name: `${r.f || ''} ${r.l || ''}`.trim(),
      orcid: cleanOrcid(r.o) || undefined,
      institution_name: (r.dp || [])[0]?.d || 'Universidad de Tarapacá',
      country_code: 'CL',
      region_scope: 'local',
      publications_count,
      citations_count,
      h_index_sdg,
      collaboration_score,
      score,
      rank: 0,
      last_updated: now,
      uta_researcher_id: getResearcherUtaId(r) || r.id,
    });
  });

  if (rows.length < limit) {
    const fromSdg = buildUtaRankingFromSdgResearchers(
      sdgName,
      sdgId,
      researchers,
      pubByOrcid,
      diag,
      limit
    );
    fromSdg.forEach((row) => {
      const key = row.uta_researcher_id || row.orcid || row.id;
      if (!seen.has(key)) {
        rows.push(row);
        seen.add(key);
      }
    });
  }

  const ordered = sortSdgRowsByPerfilesOrder(rows, researchers);
  const capped =
    limit >= UTA_SDG_RANKING_LIMIT ? ordered : ordered.slice(0, limit);
  const ranked = capped.map((row, i) => ({ ...row, rank: i + 1 }));
  diag.authorsAfterRegionFilter = ranked.length;
  diag.authorsAfterDedupe = rows.length;
  return ranked;
}
