import { describe, it, expect } from 'vitest';
import {
  buildUtaResearchersRanking,
  UTA_SDG_RANKING_LIMIT,
} from '../services/sdg/aggregateLocalWorks';
import { aggregateAuthorsFromLocalWorks } from '../services/sdg/aggregateLocalWorks';
import { SdgRankingDiagnostics } from '../services/sdg/sdgRankingDiagnostics';
import type { Researcher, Work } from '../shared/types';

const RESEARCHERS: Researcher[] = [
  { id: '222', f: 'Luis', l: 'Rojas', dp: [{ d: 'Ciencias' }] },
  { id: '111', f: 'Ana', l: 'Silva', o: '0000-0001-1111-1111', dp: [{ d: 'Ingeniería' }] },
];

const WORKS: Work[] = [
  { t: 'P1', sdgs: ['Reduced inequalities'], c: 30, autores_uta: ['111'], a: ['Ana Silva'] },
  { t: 'P2', sdgs: ['Reduced inequalities'], c: 20, autores_uta: ['111'], a: ['Ana Silva', 'Pedro Externo'] },
];

describe('local SDG ranking', () => {
  it('buildUtaResearchersRanking uses getWorksForResearcher linkage', () => {
    const diag = new SdgRankingDiagnostics(10, 'Reduced inequalities', 'local');
    const rows = buildUtaResearchersRanking(WORKS, RESEARCHERS, 'Reduced inequalities', 10, diag, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0].publications_count).toBe(2);
    expect(rows[0].citations_count).toBe(50);
  });

  it('buildUtaResearchersRanking orders by perfiles (data.json) index', () => {
    const works: Work[] = [
      { t: 'P1', sdgs: ['Reduced inequalities'], autores_uta: ['222'] },
      { t: 'P2', sdgs: ['Reduced inequalities'], autores_uta: ['111'] },
    ];
    const diag = new SdgRankingDiagnostics(10, 'Reduced inequalities', 'local');
    const rows = buildUtaResearchersRanking(
      works,
      RESEARCHERS,
      'Reduced inequalities',
      10,
      diag,
      UTA_SDG_RANKING_LIMIT
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].uta_researcher_id).toBe('222');
    expect(rows[1].uta_researcher_id).toBe('111');
  });

  it('aggregateAuthorsFromLocalWorks global includes name-only authors', () => {
    const diag = new SdgRankingDiagnostics(10, 'Reduced inequalities', 'global');
    const partial = aggregateAuthorsFromLocalWorks(
      WORKS,
      RESEARCHERS,
      10,
      'Reduced inequalities',
      'global',
      diag
    );
    expect(partial.length).toBeGreaterThanOrEqual(2);
    expect(diag.authorshipsExtracted).toBeGreaterThan(0);
  });
});
