import { describe, it, expect } from 'vitest';
import {
  approximateHIndex,
  computeCollaborationScore,
  computeSdgScore,
} from '../services/sdg/scoring';

describe('sdg scoring', () => {
  it('approximateHIndex', () => {
    expect(approximateHIndex([10, 8, 5, 4, 3])).toBe(4);
    expect(approximateHIndex([])).toBe(0);
  });

  it('computeCollaborationScore', () => {
    expect(computeCollaborationScore(2, 4)).toBe(0.5);
    expect(computeCollaborationScore(0, 0)).toBe(0);
  });

  it('computeSdgScore applies weights', () => {
    const score = computeSdgScore(10, 100, 5, 0.5);
    expect(score).toBe(10 * 0.35 + 100 * 0.35 + 5 * 0.2 + 0.5 * 100 * 0.1);
  });
});
