import {
  filterResearchers,
  filterWorks,
  getAW,
  getAuthorOA,
} from '../../utils/dataProcessing';
import { cleanOrcid } from '../../utils/helpers';
import { workIssnCandidates } from '../../utils/localQuartileProfile';
import type { Researcher, Work } from '../../shared/types';

export interface JournalSearchRaw {
  title: string;
  issns: string[];
  workCount: number;
  bestQi?: string;
}

export type SearchResult =
  | {
      kind: 'work';
      id: string;
      title: string;
      subtitle: string;
      year?: number;
      oa?: boolean;
      qi?: string;
      cites?: number;
      fwci?: number | null;
      raw: Work;
    }
  | {
      kind: 'researcher';
      id: string;
      name: string;
      subtitle: string;
      hIndex?: number | null;
      orcid?: string;
      raw: Researcher;
    }
  | {
      kind: 'journal';
      id: string;
      title: string;
      issn: string;
      qi?: string;
      raw: JournalSearchRaw;
    };

const QI_RANK: Record<string, number> = { Q1: 4, Q2: 3, Q3: 2, Q4: 1 };
const MAX_PER_KIND = 25;

type Scored<T> = { item: T; score: number };

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}

function textScore(haystack: string, query: string): number {
  const h = haystack.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  if (!h || !q) return 0;
  if (h === q) return 120;
  if (h.startsWith(q)) return 100;
  if (h.includes(q)) return 50;
  return 0;
}

function maxScore(fields: string[], query: string): number {
  if (!fields.length) return 0;
  return Math.max(0, ...fields.map((f) => textScore(f, query)));
}

function workId(work: Work): string {
  return (
    work.openalex_id ||
    work.d ||
    `work-${work.y ?? 'na'}-${stripTags(work.t || work.title || '').slice(0, 48)}`
  );
}

function researcherId(person: Researcher): string {
  return person.id?.trim() || cleanOrcid(person.o) || `${person.f}-${person.l}`;
}

function normalizeJournalKey(title: string): string {
  return title.toLowerCase().replace(/\s+/g, ' ').trim();
}

function pickBetterQi(current?: string, candidate?: string): string | undefined {
  if (!candidate) return current;
  if (!current) return candidate;
  return (QI_RANK[candidate] ?? 0) > (QI_RANK[current] ?? 0) ? candidate : current;
}

let journalIndex: Map<string, JournalSearchRaw> | null = null;

/** Limpia el índice de revistas (útil en tests). */
export function clearJournalSearchIndex(): void {
  journalIndex = null;
}

function getJournalIndex(): Map<string, JournalSearchRaw> {
  if (journalIndex) return journalIndex;

  const map = new Map<string, JournalSearchRaw>();
  for (const work of getAW() || []) {
    const title = (work.s || '').trim();
    if (!title) continue;

    const key = normalizeJournalKey(title);
    const issns = workIssnCandidates(work);
    const existing = map.get(key);
    if (existing) {
      existing.workCount += 1;
      existing.bestQi = pickBetterQi(existing.bestQi, work.qi);
      for (const issn of issns) {
        if (issn && !existing.issns.includes(issn)) existing.issns.push(issn);
      }
      continue;
    }

    map.set(key, {
      title,
      issns: [...issns],
      workCount: 1,
      bestQi: work.qi,
    });
  }

  journalIndex = map;
  return map;
}

function toWorkResult(work: Work): SearchResult {
  const title = stripTags(work.t || work.title || '') || 'Sin título';
  const authors = (work.a || []).slice(0, 3).join(', ');
  const subtitle = [work.s, authors].filter(Boolean).join(' · ') || authors || '—';

  return {
    kind: 'work',
    id: workId(work),
    title,
    subtitle,
    year: work.y,
    oa: work.oa,
    qi: work.qi,
    cites: work.c,
    fwci: work.fwci ?? work.impact ?? null,
    raw: work,
  };
}

function toResearcherResult(person: Researcher): SearchResult {
  const name = `${person.f || ''} ${person.l || ''}`.trim() || 'Investigador';
  const orcid = cleanOrcid(person.o);
  const oa = orcid ? getAuthorOA(person) : null;
  const dept = (person.dp || [])[0]?.d;
  const subtitle = [person.t, dept].filter(Boolean).join(' · ') || dept || '—';

  return {
    kind: 'researcher',
    id: researcherId(person),
    name,
    subtitle,
    hIndex: oa?.h_index ?? null,
    orcid: orcid || undefined,
    raw: person,
  };
}

function toJournalResult(entry: JournalSearchRaw, key: string): SearchResult {
  const primaryIssn = entry.issns[0] || key;
  return {
    kind: 'journal',
    id: primaryIssn || key,
    title: entry.title,
    issn: primaryIssn,
    qi: entry.bestQi,
    raw: entry,
  };
}

function searchWorks(query: string): Scored<SearchResult>[] {
  const q = query.toLowerCase().trim();
  const seen = new Set<string>();
  const scored: Scored<SearchResult>[] = [];

  const consider = (work: Work) => {
    const id = workId(work);
    if (seen.has(id)) return;

    const title = stripTags(work.t || work.title || '');
    const score = Math.max(
      textScore(title, q),
      textScore(work.s || '', q),
      textScore(work.pub || '', q),
      maxScore(work.a || [], q),
      textScore(work.d || '', q),
      maxScore(workIssnCandidates(work), q),
    );
    if (score <= 0) return;

    seen.add(id);
    scored.push({ item: toWorkResult(work), score });
  };

  filterWorks({ search: query }).forEach(consider);

  for (const work of getAW() || []) {
    const doiHit = (work.d || '').toLowerCase().includes(q);
    const issnHit = workIssnCandidates(work).some((issn) => issn.toLowerCase().includes(q));
    if (doiHit || issnHit) consider(work);
  }

  return scored;
}

function resultLabel(item: SearchResult): string {
  return item.kind === 'researcher' ? item.name : item.title;
}

function searchResearchers(query: string): Scored<SearchResult>[] {
  const q = query.toLowerCase().trim();
  return filterResearchers({ search: query }).map((person) => {
    const name = `${person.f || ''} ${person.l || ''}`.trim();
    const score = Math.max(
      textScore(name, q),
      textScore(person.t || '', q),
      textScore(person.e || '', q),
      textScore(cleanOrcid(person.o), q),
      textScore(person.o || '', q),
    );
    return { item: toResearcherResult(person), score };
  });
}

function searchJournals(query: string): Scored<SearchResult>[] {
  const q = query.toLowerCase().trim();
  const scored: Scored<SearchResult>[] = [];

  for (const [key, entry] of getJournalIndex()) {
    const score = Math.max(
      textScore(entry.title, q),
      maxScore(entry.issns, q),
    );
    if (score <= 0) continue;
    scored.push({ item: toJournalResult(entry, key), score });
  }

  return scored;
}

function takeTopPerKind(items: Scored<SearchResult>[]): SearchResult[] {
  const byKind: Record<SearchResult['kind'], Scored<SearchResult>[]> = {
    work: [],
    researcher: [],
    journal: [],
  };

  for (const row of items) {
    byKind[row.item.kind].push(row);
  }

  const merged: Scored<SearchResult>[] = [];
  for (const kind of ['researcher', 'work', 'journal'] as const) {
    merged.push(
      ...byKind[kind]
        .sort((a, b) => b.score - a.score || resultLabel(a.item).localeCompare(resultLabel(b.item), 'es'))
        .slice(0, MAX_PER_KIND),
    );
  }

  return merged
    .sort((a, b) => b.score - a.score || resultLabel(a.item).localeCompare(resultLabel(b.item), 'es'))
    .map((row) => row.item);
}

/**
 * Búsqueda unificada sobre investigadores, publicaciones y revistas.
 * Reutiliza `filterResearchers` / `filterWorks` y agrega revistas + DOI/ISSN en obras.
 */
export function unifiedSearch(query: string): SearchResult[] {
  const q = query.trim();
  if (!q) return [];

  const scored = [
    ...searchResearchers(q),
    ...searchWorks(q),
    ...searchJournals(q),
  ];

  return takeTopPerKind(scored);
}
