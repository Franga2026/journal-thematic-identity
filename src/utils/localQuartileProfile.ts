import type { QuartileProfile, Researcher, Work } from '../shared/types/index.js';
import type { Quartile } from './quartileIndex.js';

export type Tally = Record<Quartile, number>;

export function emptyTally(): Tally {
  return { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
}

function cleanOrcid(o?: string | null): string {
  return (o ?? '').replace(/https?:\/\/orcid\.org\//i, '').trim();
}

function getResearcherUtaId(person: Researcher): string {
  const id = (person.id || '').trim();
  if (id) return id;
  return cleanOrcid(person.o) || '';
}

function looksLikeOrcid(value: string): boolean {
  const v = cleanOrcid(value);
  return v.length === 19 && (v.match(/-/g) ?? []).length === 3;
}

export function buildIdToOrcid(data: Researcher[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of data) {
    const orcid = cleanOrcid(r.o);
    if (!orcid) continue;
    map.set(orcid, orcid);
    const utaId = getResearcherUtaId(r);
    if (utaId) map.set(utaId, orcid);
    if (r.id?.trim()) map.set(r.id.trim(), orcid);
  }
  return map;
}

export function resolveOrcids(
  autoresUta: Array<{ orcid?: string; rut?: string } | string> | undefined,
  idToOrcid: Map<string, string>,
): Set<string> {
  const orcids = new Set<string>();
  for (const raw of autoresUta ?? []) {
    if (raw && typeof raw === 'object' && 'orcid' in raw) {
      const o = cleanOrcid(raw.orcid);
      if (o) orcids.add(o);
      continue;
    }
    const id = String(raw || '').trim();
    if (!id) continue;
    const orcid = looksLikeOrcid(id) ? cleanOrcid(id) : idToOrcid.get(id);
    if (orcid) orcids.add(orcid);
  }
  return orcids;
}

export function workIssnCandidates(work: Work): string[] {
  const candidates = [
    ...(work.cr_issn ?? []),
    ...(work.up_issn?.split(',').map((s) => s.trim()) ?? []),
  ].filter(Boolean);
  return candidates;
}

export function toQuartileProfile(tally: Tally): QuartileProfile {
  const q1 = tally.Q1;
  const q2 = tally.Q2;
  const q3 = tally.Q3;
  const q4 = tally.Q4;
  const with_quartile = q1 + q2 + q3 + q4;
  const pct = (n: number): number | undefined =>
    with_quartile > 0 ? +((n / with_quartile) * 100).toFixed(1) : undefined;

  return {
    q1,
    q2,
    q3,
    q4,
    with_quartile,
    q1_pct: pct(q1),
    q1q2_pct: pct(q1 + q2),
  };
}

/** Agrega cuartiles por ORCID desde all-works.json (local, sin API). */
export function aggregateQuartilesFromWorks(
  works: Work[],
  getQuartile: (issns: Array<string | null | undefined>) => Quartile | null,
  idToOrcid: Map<string, string>,
  authorOrcids: Set<string>,
): Map<string, Tally> {
  const tallies = new Map<string, Tally>();

  for (const work of works) {
    const q = getQuartile(workIssnCandidates(work));
    if (!q) continue;

    const orcids = resolveOrcids(work.autores_uta, idToOrcid);
    for (const orcid of orcids) {
      if (!authorOrcids.has(orcid)) continue;
      if (!tallies.has(orcid)) tallies.set(orcid, emptyTally());
      tallies.get(orcid)![q]++;
    }
  }

  return tallies;
}
