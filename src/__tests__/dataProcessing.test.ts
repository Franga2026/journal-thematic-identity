import { describe, it, expect, beforeAll } from 'vitest';
import {
  initData, getData, getInstitution, getDepartments, getDeptCounts,
  getOrcidCount, getAuthorOA, getOrcidProfile, enrichWork,
  filterResearchers, filterWorks, getAW, buildWorkFacets,
  getWorksForResearcher, linkAutoresUta,
} from '../utils/dataProcessing';
import type { Researcher, Work } from '../shared/types';

const MOCK_RESEARCHERS: Researcher[] = [
  { id: '0000-0001', f: 'Ana', l: 'Silva', o: '0000-0001-0000-0001', dp: [{ d: 'Física' }], t: 'Profesora' },
  { id: '0000-0002', f: 'Luis', l: 'Rojas', o: '0000-0002-0000-0002', dp: [{ d: 'Química' }], t: 'Investigador' },
  { id: '0000-0004', f: 'Pedro', l: 'Mora', dp: [{ d: 'Física' }] },
  { id: '0000-0003', f: 'Carla', l: 'Díaz', o: '0000-0003-0000-0003', dp: [{ d: 'Biología' }, { d: 'Química' }], e: 'cdiaz@uta.cl' },
];

const MOCK_WORKS: Work[] = [
  {
    t: 'Quantum effects in <b>nanostructures</b>',
    y: 2023,
    c: 15,
    s: 'Nature',
    tp: 'article',
    oa: true,
    field: 'Physics',
    qi: 'Q1',
    qc: '#dc2626',
    a: ['Ana Silva', 'Luis Rojas'],
    d: '10.1234/test1',
    autores_uta: ['0000-0001', '0000-0001-0000-0001', '0000-0002'],
  },
  {
    t: 'Chemical analysis methods',
    y: 2022,
    c: 5,
    s: 'Chem Rev',
    tp: 'article',
    oa: false,
    field: 'Chemistry',
    qi: 'Q2',
    a: ['Luis Rojas'],
    autores_uta: ['0000-0002', '0000-0002-0000-0002'],
  },
  {
    t: 'Biodiversity in Atacama',
    y: 2023,
    c: 0,
    s: 'Ecology',
    tp: 'article',
    oa: true,
    field: 'Biology',
    sdgs: ['Life on land'],
    a: ['Carla Díaz'],
    autores_uta: ['0000-0003', '0000-0003-0000-0003'],
  },
  {
    t: 'Machine learning review',
    y: 2021,
    c: 50,
    s: 'AI Journal',
    tp: 'review',
    oa: false,
    field: 'Computer Science',
    a: ['Ana Silva'],
    autores_uta: ['0000-0001', '0000-0001-0000-0001'],
  },
];

const MOCK_OA = {
  institution: { works_count: 500, cited_by_count: 3000, h_index: 25, sdgs: [{ name: 'Life on land', count: 10 }] },
  authors: {
    '0000-0001-0000-0001': { works_count: 20, cited_by_count: 150, h_index: 8, works: [MOCK_WORKS[0], MOCK_WORKS[3]] },
    '0000-0002-0000-0002': { works_count: 15, cited_by_count: 80, h_index: 5, works: [MOCK_WORKS[0], MOCK_WORKS[1]] },
    '0000-0003-0000-0003': { works_count: 5, cited_by_count: 10, h_index: 2, works: [MOCK_WORKS[2]] },
  },
  sdg_researchers: { 'Life on land': ['0000-0003-0000-0003'] },
};

const MOCK_OD = {
  profiles: {
    '0000-0001-0000-0001': { coAuthors: [{ name: 'External Collab', orcid: '0000-9999', count: 3, fields: ['Physics'] }], education: [{ degree: 'PhD', institution: 'MIT', endYear: 2010 }] },
  },
};

beforeAll(() => {
  initData({ DATA: MOCK_RESEARCHERS, OA: MOCK_OA, AW: MOCK_WORKS, OD: MOCK_OD, AI: {}, COAUTHORS: {}, METRICS: { researcher_distributions: {} }, RES_METRICS: {} });
});

describe('dataProcessing', () => {
  describe('getData / getInstitution', () => {
    it('returns loaded data', () => {
      expect(getData()).toHaveLength(4);
      expect(getInstitution().h_index).toBe(25);
    });
  });

  describe('getDepartments', () => {
    it('returns unique sorted departments', () => {
      const depts = getDepartments();
      expect(depts).toContain('Física');
      expect(depts).toContain('Química');
      expect(depts).toContain('Biología');
      expect(depts).toEqual([...depts].sort());
    });
  });

  describe('getDeptCounts', () => {
    it('counts researchers per department', () => {
      const counts = getDeptCounts();
      expect(counts['Física']).toBe(2);
      expect(counts['Química']).toBe(2); // Luis + Carla
      expect(counts['Biología']).toBe(1);
    });
  });

  describe('getOrcidCount', () => {
    it('counts researchers with ORCID', () => {
      expect(getOrcidCount()).toBe(3);
    });
  });

  describe('getAuthorOA', () => {
    it('finds OA profile by ORCID', () => {
      const oa = getAuthorOA(MOCK_RESEARCHERS[0]);
      expect(oa).toBeDefined();
      expect(oa!.h_index).toBe(8);
    });

    it('returns null for researcher without ORCID', () => {
      expect(getAuthorOA(MOCK_RESEARCHERS[2])).toBeNull();
    });
  });

  describe('getOrcidProfile', () => {
    it('finds ORCID profile with coauthors and education', () => {
      const op = getOrcidProfile(MOCK_RESEARCHERS[0]);
      expect(op).toBeDefined();
      expect(op!.coAuthors).toHaveLength(1);
      expect(op!.education![0].degree).toBe('PhD');
    });
  });

  describe('enrichWork', () => {
    it('enriches work with matching all-works data', () => {
      const w: Work = { t: 'Chemical analysis methods' };
      const enriched = enrichWork(w);
      expect(enriched.y).toBe(2022);
      expect(enriched.field).toBe('Chemistry');
    });

    it('returns normalized work if no match in catalog', () => {
      const w: Work = { t: 'Nonexistent title xyz123' };
      const enriched = enrichWork(w);
      expect(enriched.t).toBe('Nonexistent title xyz123');
      expect(enriched.d).toBe('');
    });

    it('handles null input', () => {
      expect(enrichWork(null as any)).toBeNull();
    });
  });

  describe('filterResearchers', () => {
    it('filters by name', () => {
      const results = filterResearchers({ search: 'ana' });
      expect(results).toHaveLength(1);
      expect(results[0].f).toBe('Ana');
    });

    it('filters by email', () => {
      const results = filterResearchers({ search: 'cdiaz@uta' });
      expect(results).toHaveLength(1);
      expect(results[0].l).toBe('Díaz');
    });

    it('filters by department', () => {
      const results = filterResearchers({ dept: 'Física' });
      expect(results).toHaveLength(2);
    });

    it('filters ORCID-only', () => {
      const results = filterResearchers({ onlyOrcid: true });
      expect(results).toHaveLength(3);
      expect(results.every(r => r.o)).toBe(true);
    });

    it('filters by SDG', () => {
      const results = filterResearchers({ sdgFilter: 'Life on land' });
      expect(results).toHaveLength(1);
      expect(results[0].l).toBe('Díaz');
    });

    it('filters by area', () => {
      const results = filterResearchers({ areaFilter: 'Physics' });
      expect(results).toHaveLength(2); // Ana and Luis both have Physics works
    });

    it('combines multiple filters', () => {
      const results = filterResearchers({ dept: 'Física', onlyOrcid: true });
      expect(results).toHaveLength(1);
      expect(results[0].f).toBe('Ana');
    });

    it('returns all when no filters', () => {
      expect(filterResearchers({})).toHaveLength(4);
    });
  });

  describe('filterWorks', () => {
    it('filters by search term in title', () => {
      const results = filterWorks({ search: 'quantum' });
      expect(results).toHaveLength(1);
    });

    it('filters by year', () => {
      const results = filterWorks({ year: '2023' });
      expect(results).toHaveLength(2);
    });

    it('filters by type', () => {
      const results = filterWorks({ type: 'review' });
      expect(results).toHaveLength(1);
      expect(results[0].t).toContain('Machine learning');
    });

    it('filters Open Access only', () => {
      const results = filterWorks({ oa: true });
      expect(results).toHaveLength(2);
      expect(results.every(w => w.oa)).toBe(true);
    });

    it('filters by field', () => {
      const results = filterWorks({ field: 'Chemistry' });
      expect(results).toHaveLength(1);
    });

    it('filters by SDG', () => {
      const results = filterWorks({ sdg: 'Life on land' });
      expect(results).toHaveLength(1);
    });

    it('combines filters', () => {
      const results = filterWorks({ year: '2023', oa: true });
      expect(results).toHaveLength(2);
    });

    it('filters closed access via access param', () => {
      const results = filterWorks({ access: 'closed' });
      expect(results).toHaveLength(2);
      expect(results.every((w) => !w.oa)).toBe(true);
    });

    it('filters by topic or field', () => {
      expect(filterWorks({ topic: 'Physics' })).toHaveLength(1);
      expect(filterWorks({ topic: 'Biology' })).toHaveLength(1);
    });
  });

  describe('buildWorkFacets', () => {
    it('aggregates facet counts', () => {
      const facets = buildWorkFacets(MOCK_WORKS);
      expect(facets.years.length).toBeGreaterThan(0);
      expect(facets.types.some((t) => t.name === 'article')).toBe(true);
      expect(facets.access.find((a) => a.name === 'open')?.count).toBe(2);
    });
  });

  describe('getWorksForResearcher / autores_uta', () => {
    it('returns works linked by RUT/id', () => {
      const ana = MOCK_RESEARCHERS[0];
      const works = getWorksForResearcher(ana);
      expect(works.length).toBe(2);
      expect(works.every((w) => w.autores_uta?.includes('0000-0001'))).toBe(true);
    });

    it('links works by author name when autores_uta is empty', () => {
      const loose: Work[] = [{ t: 'Loose paper', y: 2020, a: ['Pedro Mora'] }];
      linkAutoresUta(MOCK_RESEARCHERS, loose, MOCK_OA);
      expect(loose[0].autores_uta).toContain('0000-0004');
    });
  });
});
