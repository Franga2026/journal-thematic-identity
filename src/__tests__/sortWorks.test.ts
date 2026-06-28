import { describe, it, expect } from 'vitest';
import { quartileSortKey, sortWorks } from '../utils/sortWorks';
import type { Work } from '../shared/types';
import { CURRENT_YEAR } from '../shared/metrics/fwci';

describe('sortWorks', () => {
  const works: Work[] = [
    { t: 'Old low', y: 2020, c: 2, impact: 0.5 },
    { t: 'Recent zero', y: CURRENT_YEAR, c: 0, impact: 0 },
    { t: 'Top cited', y: 2022, c: 100, impact: 3 },
    { t: 'High fwci', y: 2021, c: 5, impact: 8 },
  ];

  it('preserves order for relevance', () => {
    expect(sortWorks(works, 'relevance').map((w) => w.t)).toEqual([
      'Old low', 'Recent zero', 'Top cited', 'High fwci',
    ]);
  });

  it('sorts by citations descending', () => {
    expect(sortWorks(works, 'citations').map((w) => w.t)).toEqual([
      'Top cited', 'High fwci', 'Old low', 'Recent zero',
    ]);
  });

  it('sorts by fwci descending, excluding current year from top', () => {
    expect(sortWorks(works, 'fwci').map((w) => w.t)).toEqual([
      'High fwci', 'Top cited', 'Old low', 'Recent zero',
    ]);
  });

  it('sorts by year descending', () => {
    expect(sortWorks(works, 'year').map((w) => w.t)).toEqual([
      'Recent zero', 'Top cited', 'High fwci', 'Old low',
    ]);
  });

  it('sorts by quartile ascending with no-qi works at end, tiebreak citations', () => {
    const quartileWorks: Work[] = [
      { t: 'No qi high cites', c: 50 },
      { t: 'Q4 low', qi: 'Q4', c: 1 },
      { t: 'Q1 low', qi: 'Q1', c: 2 },
      { t: 'Q1 high', qi: 'Q1', c: 40 },
      { t: 'Q3', qi: 'Q3', c: 10 },
    ];
    expect(sortWorks(quartileWorks, 'quartile').map((w) => w.t)).toEqual([
      'Q1 high',
      'Q1 low',
      'Q3',
      'Q4 low',
      'No qi high cites',
    ]);
  });
});

describe('quartileSortKey', () => {
  it('maps Q1–Q4 and sends empty to end', () => {
    expect(quartileSortKey('Q1')).toBe(1);
    expect(quartileSortKey('q4')).toBe(4);
    expect(quartileSortKey('2')).toBe(2);
    expect(quartileSortKey('')).toBe(99);
    expect(quartileSortKey(undefined)).toBe(99);
  });
});
