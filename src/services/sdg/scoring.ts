import { SDG_SCORE_WEIGHTS } from './constants';

export function computeCollaborationScore(multiCountryWorkCount: number, publicationsCount: number): number {
  if (publicationsCount <= 0) return 0;
  return Math.min(1, multiCountryWorkCount / publicationsCount);
}

export function computeSdgScore(
  publicationsCount: number,
  citationsCount: number,
  hIndexSdg: number,
  collaborationScore: number
): number {
  const { publications, citations, hIndex, collaboration } = SDG_SCORE_WEIGHTS;
  return (
    publicationsCount * publications +
    citationsCount * citations +
    hIndexSdg * hIndex +
    collaborationScore * 100 * collaboration
  );
}

/** h-index sobre el subconjunto de citas de obras del ODS */
export function approximateHIndex(citationsPerWork: number[]): number {
  if (!citationsPerWork.length) return 0;
  const sorted = [...citationsPerWork].sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) h = i + 1;
    else break;
  }
  return h;
}
