/**
 * Ecosistema bibliométrico de un autor externo a partir de sus obras OpenAlex.
 */

import { getData } from '../../utils/dataProcessing';
import { findResearcherByOpenAlexAuthorId } from '../../utils/researcherProfile';
import { getWorkIssns } from '../../utils/scopusUrlLookup';

export interface WorkAuthorshipEco {
  author_id: string | null;
  name: string;
  institution: string | null;
  country: string | null;
}

export interface WorkForEcosystem {
  title: string;
  year: number | null;
  journal: string | null;
  issn_l: string | null;
  /** Crossref / OpenAlex issn[] (print + online). */
  cr_issn?: string[] | string | null;
  /** Unpaywall ISSN(s), a menudo CSV. */
  up_issn?: string | null;
  fwci: number | null;
  cited_by_count: number;
  is_oa: boolean;
  oa_status: string | null;
  type: string | null;
  quartile: 'Q1' | 'Q2' | 'Q3' | 'Q4' | null;
  field: string | null;
  doi?: string | null;
  openalex_id?: string | null;
  pdf_url?: string | null;
  oa_url?: string | null;
  landing_url?: string | null;
  best_oa_repo?: string | null;
  authorships: WorkAuthorshipEco[];
}

export interface EcosystemCoauthor {
  author_id: string | null;
  name: string;
  institution: string | null;
  country: string | null;
  worksTogether: number;
  isUta: boolean;
}

export interface AuthorEcosystem {
  topCoauthors: EcosystemCoauthor[];
  topJournals: Array<{ name: string; count: number }>;
  topInstitutions: Array<{ name: string; count: number }>;
  topCountries: Array<{ code: string; count: number }>;
  topFields: Array<{ name: string; count: number }>;
  uniqueCountries: number;
  uniqueInstitutions: number;
  utaCoauthorCount: number;
  oa: {
    openCount: number;
    total: number;
    pct: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  quartiles: {
    Q1: number;
    Q2: number;
    Q3: number;
    Q4: number;
    withQuartile: number;
  };
  collaboration: {
    internationalPct: number;
    nationalPct: number;
    institutionalPct: number;
  };
}

export interface FeaturedWork {
  title: string;
  year: number | null;
  journal: string | null;
  issn_l: string | null;
  cr_issn?: string[] | string | null;
  up_issn?: string | null;
  cited_by_count: number;
  fwci: number | null;
  quartile: 'Q1' | 'Q2' | 'Q3' | 'Q4' | null;
  is_oa: boolean;
  oa_status: string | null;
  doi: string | null;
  type: string | null;
  openalex_id?: string | null;
  pdf_url?: string | null;
  oa_url?: string | null;
  landing_url?: string | null;
  best_oa_repo?: string | null;
}

function toFeaturedWork(w: WorkForEcosystem): FeaturedWork {
  return {
    title: w.title,
    year: w.year,
    journal: w.journal,
    issn_l: getWorkIssns(w)[0] ?? null, // el primero disponible
    cr_issn: w.cr_issn ?? null,
    up_issn: w.up_issn ?? null,
    cited_by_count: w.cited_by_count,
    fwci: w.fwci,
    quartile: w.quartile,
    is_oa: w.is_oa,
    oa_status: w.oa_status,
    doi: w.doi ?? null,
    type: w.type,
    openalex_id: w.openalex_id ?? null,
    pdf_url: w.pdf_url ?? null,
    oa_url: w.oa_url ?? null,
    landing_url: w.landing_url ?? null,
    best_oa_repo: w.best_oa_repo ?? null,
  };
}

function normName(s: string): string {
  return (s || '').trim().toLowerCase();
}

function topEntries<T extends string>(
  counts: Map<T, number>,
  limit: number,
): Array<{ key: T; count: number }> {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

export function computeEcosystem(
  works: WorkForEcosystem[],
  authorName: string,
): AuthorEcosystem {
  const catalog = getData();
  const self = normName(authorName);
  const coauthorCounts = new Map<string, { row: EcosystemCoauthor; count: number }>();
  const instCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const fieldCounts = new Map<string, number>();
  const journalCounts = new Map<string, number>();
  const uniqueCountrySet = new Set<string>();
  const uniqueInstSet = new Set<string>();
  const oaByStatus = new Map<string, number>();
  const quartiles = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, withQuartile: 0 };

  let intl = 0;
  let natl = 0;
  let inst = 0;
  let oaOpen = 0;

  for (const w of works) {
    if (w.is_oa) oaOpen += 1;
    const status = w.oa_status || (w.is_oa ? 'open' : 'closed');
    oaByStatus.set(status, (oaByStatus.get(status) || 0) + 1);

    if (w.quartile) {
      quartiles[w.quartile] += 1;
      quartiles.withQuartile += 1;
    }

    if (w.field) {
      fieldCounts.set(w.field, (fieldCounts.get(w.field) || 0) + 1);
    }
    if (w.journal) {
      journalCounts.set(w.journal, (journalCounts.get(w.journal) || 0) + 1);
    }

    const countries = new Set<string>();
    const insts = new Set<string>();
    for (const a of w.authorships) {
      if (a.country) countries.add(a.country);
      if (a.institution) insts.add(a.institution);

      const name = (a.name || '').trim();
      if (!name || normName(name) === self) continue;
      const key = a.author_id || name;
      const prev = coauthorCounts.get(key);
      if (prev) {
        prev.count += 1;
      } else {
        coauthorCounts.set(key, {
          count: 1,
          row: {
            author_id: a.author_id,
            name,
            institution: a.institution,
            country: a.country,
            worksTogether: 0,
            isUta: a.author_id ? !!findResearcherByOpenAlexAuthorId(a.author_id, catalog) : false,
          },
        });
      }

      if (a.country) {
        countryCounts.set(a.country, (countryCounts.get(a.country) || 0) + 1);
        countries.add(a.country);
        uniqueCountrySet.add(a.country);
      }
      if (a.institution) {
        instCounts.set(a.institution, (instCounts.get(a.institution) || 0) + 1);
        insts.add(a.institution);
        uniqueInstSet.add(a.institution);
      }
    }

    if (countries.size >= 2) intl += 1;
    else if (insts.size >= 2) natl += 1;
    else inst += 1;
  }

  const scopeTotal = intl + natl + inst || 1;

  const utaCoauthorCount = [...coauthorCounts.values()].filter((v) => v.row.isUta).length;

  const topCoauthors = [...coauthorCounts.values()]
    .sort((a, b) => {
      if (a.row.isUta !== b.row.isUta) return a.row.isUta ? -1 : 1;
      return b.count - a.count;
    })
    .slice(0, 8)
    .map(({ row, count }) => ({ ...row, worksTogether: count }));

  return {
    topCoauthors,
    topJournals: topEntries(journalCounts, 5).map(({ key, count }) => ({ name: key, count })),
    topInstitutions: topEntries(instCounts, 6).map(({ key, count }) => ({ name: key, count })),
    topCountries: topEntries(countryCounts, 6).map(({ key, count }) => ({ code: key, count })),
    topFields: topEntries(fieldCounts, 5).map(({ key, count }) => ({ name: key, count })),
    uniqueCountries: uniqueCountrySet.size,
    uniqueInstitutions: uniqueInstSet.size,
    utaCoauthorCount,
    oa: {
      openCount: oaOpen,
      total: works.length,
      pct: works.length ? Math.round((oaOpen / works.length) * 100) : 0,
      byStatus: [...oaByStatus.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => ({ status, count })),
    },
    quartiles,
    collaboration: {
      internationalPct: Math.round((intl / scopeTotal) * 100),
      nationalPct: Math.round((natl / scopeTotal) * 100),
      institutionalPct: Math.round((inst / scopeTotal) * 100),
    },
  };
}

export function topWorks(works: WorkForEcosystem[], limit = 6): FeaturedWork[] {
  return works
    .slice()
    .sort((a, b) => (b.cited_by_count || 0) - (a.cited_by_count || 0))
    .slice(0, limit)
    .map(toFeaturedWork);
}

export type WorkSortMode = 'fwci' | 'citas' | 'anio';

export function sortWorksForDisplay(
  works: WorkForEcosystem[],
  mode: WorkSortMode,
  limit?: number,
): FeaturedWork[] {
  const sorted = works.slice();
  if (mode === 'fwci') {
    sorted.sort((a, b) => (b.fwci ?? -1) - (a.fwci ?? -1));
  } else if (mode === 'citas') {
    sorted.sort((a, b) => b.cited_by_count - a.cited_by_count);
  } else {
    sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  }
  const slice = limit != null ? sorted.slice(0, limit) : sorted;
  return slice.map(toFeaturedWork);
}
