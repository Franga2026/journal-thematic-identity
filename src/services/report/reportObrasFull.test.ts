import { describe, it, expect } from 'vitest';
import type { Work } from '../../shared/types';
import {
  buildObrasFull,
  filterWorksByAuthorshipOrcid,
  normalizeReportDoi,
  quartileOf,
} from './reportObrasFull';

describe('reportObrasFull', () => {
  it('normalizeReportDoi quita prefijo doi.org', () => {
    expect(normalizeReportDoi('https://doi.org/10.1234/abc')).toBe('10.1234/abc');
    expect(normalizeReportDoi('')).toBeUndefined();
  });

  it('filtra por ORCID en authorships y excluye datasets', () => {
    const works: Work[] = [
      {
        t: 'Paper',
        y: 2024,
        authorships: [{ author: { orcid: '0000-0001-5228-1180' } }],
      },
      { t: 'Dataset', y: 2024, tp: 'dataset', authorships: [{ author: { orcid: '0000-0001-5228-1180' } }] },
      { t: 'Other', y: 2023, authorships: [{ author: { orcid: '0000-0000-0000-0001' } }] },
    ];
    const mine = filterWorksByAuthorshipOrcid(works, '0000-0001-5228-1180');
    expect(mine).toHaveLength(1);
    expect(mine[0].t).toBe('Paper');
  });

  it('buildObrasFull mapea campos', () => {
    const works: Work[] = [
      { t: 'Old', y: 2020, c: 5, d: '10.1/old', qi: 'Q2', authorships: [] },
      { t: 'New', y: 2024, c: 50, doi: 'https://doi.org/10.1/new', qi: 'Q1', ou: 'https://example.org/new', authorships: [] },
    ];
    const rows = buildObrasFull(works, new Map());
    const newer = rows.find((r) => r.titulo === 'New')!;
    expect(newer.doi).toBe('10.1/new');
    expect(newer.url).toBe('https://example.org/new');
    expect(quartileOf(works[1], new Map())).toBe('Q1');
  });
});
