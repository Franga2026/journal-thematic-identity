import { describe, expect, it } from 'vitest';
import {
  formatQuartilePct,
  isQuartileRankEligible,
  quartileSummaryLine,
  QUARTILE_NO_DATA,
} from '../utils/quartileDisplay';

describe('quartileDisplay', () => {
  it('formatQuartilePct uses es-CL decimal comma', () => {
    expect(formatQuartilePct(92.6)).toBe('92,6%');
  });

  it('returns dash when with_quartile is 0', () => {
    expect(quartileSummaryLine({ with_quartile: 0 }, 'q1').text).toBe(QUARTILE_NO_DATA);
  });

  it('formats Q1 line with denominator', () => {
    const line = quartileSummaryLine(
      { q1: 25, q1_pct: 92.6, with_quartile: 27 },
      'q1',
    );
    expect(line.text).toBe('Q1: 92,6% · 25 de 27 obras con cuartil SJR');
    expect(line.muted).toBe(false);
  });

  it('flags small sample', () => {
    const line = quartileSummaryLine(
      { q1: 2, q1_pct: 100, with_quartile: 3 },
      'q1',
    );
    expect(line.muted).toBe(true);
    expect(line.note).toBe('muestra insuficiente');
  });

  it('rank eligible at 10+ works with quartile', () => {
    expect(isQuartileRankEligible({ with_quartile: 10 })).toBe(true);
    expect(isQuartileRankEligible({ with_quartile: 9 })).toBe(false);
  });
});
