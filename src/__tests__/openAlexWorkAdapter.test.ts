import { describe, it, expect } from 'vitest';
import { workItemToWork } from '../utils/openAlexWorkAdapter';
import type { OpenAlexWorkItem } from '../services/odsService';

const ITEM: OpenAlexWorkItem = {
  id: 'W123',
  title: 'Sample Work',
  year: 2024,
  venue: 'Nature',
  citedByCount: 17,
  fwci: 1.42,
  doiUrl: 'https://doi.org/10.1234/x',
  isOpenAccess: true,
  authors: ['A. Author', 'B. Coauthor'],
  volume: '12',
  issue: '3',
  pages: '10-20',
  docType: 'article',
};

describe('workItemToWork', () => {
  it('maps OpenAlex fields to canonical Work', () => {
    const w = workItemToWork(ITEM);
    expect(w.t).toBe('Sample Work');
    expect(w.y).toBe(2024);
    expect(w.a).toEqual(['A. Author', 'B. Coauthor']);
    expect(w.d).toBe('https://doi.org/10.1234/x');
    expect(w.u).toBe('https://doi.org/10.1234/x');
    expect(w.s).toBe('Nature');
    expect(w.tp).toBe('article');
    expect(w.vol).toBe('12');
    expect(w.issue).toBe('3');
    expect(w.pages).toBe('10-20');
    expect(w.openalex_id).toBe('W123');
    expect(w.c).toBe(17);
    expect(w.oa).toBe(true);
    expect(w.impact).toBe(1.42);
    expect(w.fwci).toBe(1.42);
  });

  it('leaves enrichment-only fields undefined', () => {
    const w = workItemToWork(ITEM);
    expect(w.qi).toBeUndefined();
    expect(w.sdgs).toBeUndefined();
    expect(w.autores_uta).toBeUndefined();
    expect(w.field).toBeUndefined();
  });

  it('handles null year and fwci', () => {
    const w = workItemToWork({ ...ITEM, year: null, fwci: null, isOpenAccess: false });
    expect(w.y).toBeUndefined();
    expect(w.impact).toBeUndefined();
    expect(w.fwci).toBeUndefined();
    expect(w.oa).toBe(false);
  });
});
