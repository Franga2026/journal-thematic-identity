import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  initData,
  getAuthorOA,
} from '../utils/dataProcessing';
import type { Researcher, Work } from '../shared/types';
import {
  clearJournalSearchIndex,
  unifiedSearch,
} from '../services/search/unifiedSearch';

const MOCK_RESEARCHERS: Researcher[] = [
  { id: 'uta-1', f: 'Ana', l: 'Silva', o: '0000-0001-0000-0001', dp: [{ d: 'Física' }], t: 'Profesora' },
  { id: 'uta-2', f: 'Luis', l: 'Rojas', o: '0000-0002-0000-0002', dp: [{ d: 'Química' }], t: 'Investigador' },
];

const MOCK_WORKS: Work[] = [
  {
    t: 'Quantum effects in nanostructures',
    y: 2023,
    c: 15,
    s: 'Nature Physics',
    tp: 'article',
    oa: true,
    field: 'Physics',
    qi: 'Q1',
    a: ['Ana Silva'],
    d: '10.1234/nature.test',
    cr_issn: ['1745-2473'],
  },
  {
    t: 'Soil carbon in Atacama',
    y: 2021,
    c: 4,
    s: 'Journal of Arid Environments',
    tp: 'article',
    oa: false,
    qi: 'Q2',
    a: ['Luis Rojas'],
    up_issn: '0140-1963',
  },
];

const MOCK_OA = {
  authors: {
    '0000-0001-0000-0001': { h_index: 12, works_count: 20, cited_by_count: 100 },
    '0000-0002-0000-0002': { h_index: 8, works_count: 10, cited_by_count: 40 },
  },
  sdg_researchers: {},
};

describe('unifiedSearch', () => {
  beforeAll(() => {
    initData({
      DATA: MOCK_RESEARCHERS,
      OA: MOCK_OA,
      AW: MOCK_WORKS,
    });
  });

  beforeEach(() => {
    clearJournalSearchIndex();
  });

  it('returns empty array for blank query', () => {
    expect(unifiedSearch('')).toEqual([]);
    expect(unifiedSearch('   ')).toEqual([]);
  });

  it('finds researchers via filterResearchers', () => {
    const results = unifiedSearch('ana');
    const researcher = results.find((r) => r.kind === 'researcher');
    expect(researcher?.kind).toBe('researcher');
    if (researcher?.kind === 'researcher') {
      expect(researcher.name).toContain('Ana');
      expect(researcher.hIndex).toBe(12);
    }
  });

  it('finds works via filterWorks and DOI', () => {
    const byTitle = unifiedSearch('quantum');
    expect(byTitle.some((r) => r.kind === 'work' && r.title.includes('Quantum'))).toBe(true);

    const byDoi = unifiedSearch('10.1234/nature');
    const work = byDoi.find((r) => r.kind === 'work');
    expect(work?.kind).toBe('work');
    if (work?.kind === 'work') {
      expect(work.id).toContain('10.1234');
      expect(work.qi).toBe('Q1');
    }
  });

  it('finds journals aggregated from works', () => {
    const results = unifiedSearch('nature physics');
    const journal = results.find((r) => r.kind === 'journal');
    expect(journal?.kind).toBe('journal');
    if (journal?.kind === 'journal') {
      expect(journal.title).toBe('Nature Physics');
      expect(journal.issn).toBe('1745-2473');
      expect(journal.qi).toBe('Q1');
    }
  });

  it('ranks exact title matches ahead of partial contains', () => {
    const results = unifiedSearch('Nature Physics');
    expect(results[0]?.kind).toBe('journal');
  });

  it('uses getAuthorOA for researcher h-index when available', () => {
    const oa = getAuthorOA(MOCK_RESEARCHERS[0]);
    expect(oa?.h_index).toBe(12);
  });
});
