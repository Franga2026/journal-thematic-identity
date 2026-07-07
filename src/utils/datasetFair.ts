import { normalizeDoi } from './datasetUsage';

export type FairScores = {
  findable: number;
  accessible: number;
  interoperable: number;
  reusable: number;
  overall: number;
};

const cache = new Map<string, FairScores | null>();

export function clearFairScoresCache(): void {
  cache.clear();
}

function roundScore(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Puntuaciones FAIR (F-UJI vía fairdata.ai) para un dataset con DOI.
 * Devuelve null si no hay DOI, no está evaluado o hay error de red.
 */
export async function fetchFairScores(rawDoi: string): Promise<FairScores | null> {
  const doi = normalizeDoi(rawDoi);
  if (!doi) return null;
  if (cache.has(doi)) return cache.get(doi) ?? null;

  try {
    const res = await fetch(`https://fairdata.ai/api/dataset/${encodeURIComponent(doi)}`);
    if (!res.ok) {
      if (res.status === 404) cache.set(doi, null);
      return null;
    }

    const json = await res.json();
    if (json?.error === 'not_assessed' || !json?.scores) {
      cache.set(doi, null);
      return null;
    }

    const s = json.scores;
    const scores: FairScores = {
      findable: roundScore(s.F),
      accessible: roundScore(s.A),
      interoperable: roundScore(s.I),
      reusable: roundScore(s.R),
      overall: roundScore(s.overall ?? json.fair_score ?? json.base_score),
    };
    cache.set(doi, scores);
    return scores;
  } catch {
    return null;
  }
}
