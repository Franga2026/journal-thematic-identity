import { describe, it, expect } from 'vitest';
import {
  computeHIndex,
  detectIdentityMergeFlag,
  IDENTITY_MERGE_RATIO_THRESHOLD,
} from '../utils/openAlexMetrics';

describe('openAlexWorksMetrics', () => {
  describe('computeHIndex', () => {
    it('calcula h clásico', () => {
      expect(computeHIndex([10, 8, 5, 4, 3, 1])).toBe(4);
      expect(computeHIndex([0, 0, 0])).toBe(0);
      expect(computeHIndex([100])).toBe(1);
    });
  });

  describe('detectIdentityMergeFlag', () => {
    it('marca fusión cuando perfil >> obras reales', () => {
      expect(detectIdentityMergeFlag(1566, 141)).toBe('possible_merge');
      expect(detectIdentityMergeFlag(20, 18)).toBeNull();
      expect(detectIdentityMergeFlag(10, 5)).toBe('possible_merge');
    });

    it('usa umbral configurable', () => {
      expect(detectIdentityMergeFlag(100, 50, 3)).toBeNull();
      expect(detectIdentityMergeFlag(100, 50, 2)).toBe('possible_merge');
    });

    it('exporta umbral por defecto', () => {
      expect(IDENTITY_MERGE_RATIO_THRESHOLD).toBe(2);
    });
  });
});
