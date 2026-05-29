import { describe, it, expect } from 'vitest';
import { groupWorksByArea, getWorkAreaLabel } from '../utils/areaGrouping';
import type { Work } from '../shared/types';

const WORKS: Work[] = [
  { t: 'A', field: 'Physics and Astronomy', y: 2023 },
  { t: 'B', field: 'Physics and Astronomy', y: 2022 },
  { t: 'C', topic: 'Social Sciences', y: 2021 },
  { t: 'D', y: 2020 },
];

describe('areaGrouping', () => {
  it('getWorkAreaLabel prefers field over topic', () => {
    expect(getWorkAreaLabel({ field: 'F', topic: 'T' })).toBe('F');
    expect(getWorkAreaLabel({ topic: 'T' })).toBe('T');
    expect(getWorkAreaLabel({})).toBeNull();
  });

  it('groupWorksByArea counts and percentages', () => {
    const groups = groupWorksByArea(WORKS);
    expect(groups).toHaveLength(2);
    expect(groups[0].name).toBe('Physics and Astronomy');
    expect(groups[0].count).toBe(2);
    expect(groups[0].sharePct).toBe(50);
    expect(groups[0].donutPct).toBe(100);
    expect(groups[1].name).toBe('Social Sciences');
    expect(groups[1].donutPct).toBe(50);
  });

  it('returns empty for no labeled works', () => {
    expect(groupWorksByArea([{ t: 'X' }])).toEqual([]);
  });
});
