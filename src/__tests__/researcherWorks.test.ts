import { describe, it, expect, beforeAll } from 'vitest';
import { initData } from '../utils/dataProcessing';
import { filterWorksByResearcher, getEnrichedWorksForResearcher } from '../utils/researcherWorks';
import type { Researcher, Work } from '../shared/types';
import { utaLink } from './utaLinkFixtures';

const RESEARCHER: Researcher = {
  id: '0000-0001',
  f: 'Ana',
  l: 'Silva',
  o: '0000-0001-0000-0001',
};

const WORKS: Work[] = [
  { t: 'Paper A', y: 2023, autores_uta: [utaLink('0000-0001', '0000-0001-0000-0001', 'Ana Silva', 0)] },
  { t: 'Paper B', y: 2022, autores_uta: [utaLink('0000-0002', '0000-0002-0000-0002', 'Luis Rojas', 0)] },
  { t: 'Paper C', y: 2021, autores_uta: [utaLink('0000-0001', '0000-0001-0000-0001', 'Ana Silva', 0)] },
];

beforeAll(() => {
  initData({
    DATA: [RESEARCHER],
    OA: { institution: {}, authors: {}, sdg_researchers: {} },
    AW: WORKS,
    OD: { profiles: {} },
    AI: {},
    COAUTHORS: {},
    METRICS: { researcher_distributions: {} },
    RES_METRICS: {},
  });
});

describe('researcherWorks', () => {
  it('filterWorksByResearcher matches id and orcid in autores_uta', () => {
    const filtered = filterWorksByResearcher(RESEARCHER);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((w) => w.t)).toEqual(['Paper A', 'Paper C']);
  });

  it('getEnrichedWorksForResearcher returns enriched copies', () => {
    const enriched = getEnrichedWorksForResearcher(RESEARCHER);
    expect(enriched).toHaveLength(2);
    expect(enriched[0].t).toBe('Paper A');
  });
});
