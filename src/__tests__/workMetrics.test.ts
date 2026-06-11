import { describe, it, expect } from 'vitest';
import {
  computeMeanEligibleWorkFwci,
  fwciIsEligible,
  getFwciCurrentYear,
  getWorkOpenAlexCitations,
  getWorkOpenAlexFwci,
  mapOpenAlexWorkMetrics,
} from '../utils/workMetrics';
import type { Work } from '../shared/types';

describe('workMetrics', () => {
  it('getWorkOpenAlexCitations prefers cited_by_count over c', () => {
    const w: Work = { c: 10, cited_by_count: 42 };
    expect(getWorkOpenAlexCitations(w)).toBe(42);
  });

  it('getWorkOpenAlexCitations falls back to c', () => {
    expect(getWorkOpenAlexCitations({ c: 7 })).toBe(7);
  });

  it('getWorkOpenAlexFwci prefers fwci over impact', () => {
    const w: Work = { fwci: 1.2, impact: 9.9 };
    expect(getWorkOpenAlexFwci(w)).toBe(1.2);
  });

  it('getWorkOpenAlexFwci returns 0 when OpenAlex fwci is zero', () => {
    expect(getWorkOpenAlexFwci({ fwci: 0 })).toBe(0);
  });

  it('getWorkOpenAlexFwci returns null when no metric', () => {
    expect(getWorkOpenAlexFwci({})).toBeNull();
  });

  it('mapOpenAlexWorkMetrics maps fwci and cited_by_count to canonical fields', () => {
    expect(mapOpenAlexWorkMetrics({ fwci: 0.87, cited_by_count: 0 })).toEqual({
      fwci: 0.87,
      cited_by_count: 0,
      c: 0,
      impact: 0.87,
    });
  });

  it('fwciIsEligible rejects current-year works even with fwci 0', () => {
    const currentYear = getFwciCurrentYear();
    expect(fwciIsEligible({ y: currentYear, impact: 0 })).toBe(false);
    expect(fwciIsEligible({ y: currentYear, fwci: 0 })).toBe(false);
  });

  it('fwciIsEligible accepts prior-year works with impact', () => {
    expect(fwciIsEligible({ y: 2023, impact: 0 })).toBe(true);
    expect(fwciIsEligible({ y: 2023, impact: 1.4 })).toBe(true);
  });

  it('fwciIsEligible rejects works without impact/fwci', () => {
    expect(fwciIsEligible({ y: 2023 })).toBe(false);
  });

  it('computeMeanEligibleWorkFwci excludes current-year works from aggregate', () => {
    const currentYear = getFwciCurrentYear();
    const result = computeMeanEligibleWorkFwci([
      { y: currentYear, impact: 0 },
      { y: 2023, impact: 2 },
      { y: 2022, impact: 1 },
    ]);
    expect(result).toEqual({ fwci: 1.5, n: 2 });
  });
});
