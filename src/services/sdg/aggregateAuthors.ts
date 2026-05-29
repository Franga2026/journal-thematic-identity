import type { SdgRegionScope, SdgRankedResearcher } from '../../shared/types/sdgResearcher';
import { isUTAInstitution } from '../../utils/institutionMatch';
import { getPublicationAuthorships } from '../../utils/publicationAuthorships';
import { IBEROAMERICA_COUNTRY_SET } from './constants';
import { approximateHIndex, computeCollaborationScore, computeSdgScore } from './scoring';
import type { OpenAlexWorkAuthorship, OpenAlexWorkResult } from './openAlexTypes';

interface InstitutionTally {
  openalexId: string;
  name: string;
  countryCode?: string;
  count: number;
}

interface AuthorAccumulator {
  authorOpenalexId: string;
  authorName: string;
  orcid?: string;
  citationsPerWork: number[];
  institutions: Map<string, InstitutionTally>;
  multiCountryWorkCount: number;
}

function parseOpenAlexId(urlOrId: string): string {
  return urlOrId.replace('https://openalex.org/', '').trim();
}

function parseOrcid(orcid?: string | null): string | undefined {
  if (!orcid?.trim()) return undefined;
  return orcid.replace('https://orcid.org/', '').trim() || undefined;
}


function collectCountriesFromWork(authorships: OpenAlexWorkAuthorship[]): Set<string> {
  const countries = new Set<string>();
  authorships.forEach((a) => {
    (a.countries || []).forEach((c) => {
      if (c) countries.add(c.toUpperCase());
    });
    (a.institutions || []).forEach((inst) => {
      if (inst.country_code) countries.add(inst.country_code.toUpperCase());
    });
  });
  return countries;
}

function pickPrimaryInstitution(institutions: Map<string, InstitutionTally>): InstitutionTally | undefined {
  let best: InstitutionTally | undefined;
  institutions.forEach((inst) => {
    if (!best || inst.count > best.count) best = inst;
  });
  return best;
}

function authorPassesRegionFilter(
  acc: AuthorAccumulator,
  scope: SdgRegionScope
): boolean {
  if (scope === 'global') return true;

  const countries = new Set<string>();
  let hasUtaAffiliation = false;

  acc.institutions.forEach((inst) => {
    if (inst.countryCode) countries.add(inst.countryCode.toUpperCase());
    if (isUTAInstitution(inst.name)) hasUtaAffiliation = true;
  });

  if (scope === 'local') {
    return hasUtaAffiliation || countries.has('CL');
  }

  if (scope === 'iberoamerica') {
    if (countries.length === 0) return true;
    return [...countries].some((c) => IBEROAMERICA_COUNTRY_SET.has(c));
  }

  return true;
}

export function aggregateAuthorsFromWorks(
  works: OpenAlexWorkResult[],
  sdgId: number,
  scope: SdgRegionScope
): Omit<SdgRankedResearcher, 'rank' | 'last_updated'>[] {
  const byAuthor = new Map<string, AuthorAccumulator>();

  works.forEach((work) => {
    const authorships = getPublicationAuthorships(work) as OpenAlexWorkAuthorship[];
    const workCountries = collectCountriesFromWork(authorships);
    const isMultiCountry = workCountries.size > 1;
    const citations = work.cited_by_count ?? 0;

    authorships.forEach((authorship) => {
      const authorRef = authorship.author;
      if (!authorRef?.id) return;

      const authorOpenalexId = parseOpenAlexId(authorRef.id);
      if (!authorOpenalexId) return;

      let acc = byAuthor.get(authorOpenalexId);
      if (!acc) {
        acc = {
          authorOpenalexId,
          authorName: authorRef.display_name || 'Sin nombre',
          orcid: parseOrcid(authorRef.orcid),
          citationsPerWork: [],
          institutions: new Map(),
          multiCountryWorkCount: 0,
        };
        byAuthor.set(authorOpenalexId, acc);
      }

      acc.authorName = authorRef.display_name || acc.authorName;
      const orcid = parseOrcid(authorRef.orcid);
      if (orcid) acc.orcid = orcid;

      acc.citationsPerWork.push(citations);
      if (isMultiCountry) acc.multiCountryWorkCount += 1;

      (authorship.institutions || []).forEach((inst) => {
        if (!inst.id) return;
        const key = parseOpenAlexId(inst.id);
        const prev = acc!.institutions.get(key);
        if (prev) {
          prev.count += 1;
        } else {
          acc!.institutions.set(key, {
            openalexId: key,
            name: inst.display_name || 'Institución desconocida',
            countryCode: inst.country_code?.toUpperCase(),
            count: 1,
          });
        }
      });
    });
  });

  const rows: Omit<SdgRankedResearcher, 'rank' | 'last_updated'>[] = [];

  byAuthor.forEach((acc) => {
    if (!authorPassesRegionFilter(acc, scope)) return;

    const publications_count = acc.citationsPerWork.length;
    if (publications_count === 0) return;

    const citations_count = acc.citationsPerWork.reduce((sum, c) => sum + c, 0);
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
    const primary = pickPrimaryInstitution(acc.institutions);

    rows.push({
      id: `${sdgId}-${scope}-${acc.authorOpenalexId}`,
      sdg_id: sdgId,
      author_openalex_id: acc.authorOpenalexId,
      author_name: acc.authorName,
      orcid: acc.orcid,
      institution_name: primary?.name,
      institution_openalex_id: primary?.openalexId,
      country_code: primary?.countryCode,
      region_scope: scope,
      publications_count,
      citations_count,
      h_index_sdg,
      collaboration_score,
      score,
    });
  });

  rows.sort((a, b) => b.score - a.score || b.citations_count - a.citations_count);
  return rows;
}
