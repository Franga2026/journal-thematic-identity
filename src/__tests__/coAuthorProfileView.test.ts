import { describe, it, expect } from 'vitest';
import {
  buildCoAuthorKpiCards,
  countUtaCoauthorsFromWorks,
  listUtaCollaboratorsFromWorks,
} from '../utils/coAuthorProfileView';
import type { CoAuthorProfile, Researcher, Work } from '../shared/types';
import { utaLink } from './utaLinkFixtures';

describe('buildCoAuthorKpiCards', () => {
  it('includes only KPIs with real data (no forced zeros)', () => {
    const profile: CoAuthorProfile = {
      name: 'Test Coauthor',
      works_count: 5,
      cited_by_count: 120,
      h_index: 4,
      works: [
        { t: 'Paper', y: 2020, c: 40, oa: true },
        { t: 'Paper 2', y: 2019, c: 80, oa: false },
      ],
    };
    const cards = buildCoAuthorKpiCards(profile, 2, { datasetsCount: 0 });
    const labels = cards.map((c) => c.label);
    expect(labels).toContain('Publicaciones');
    expect(labels).toContain('Datasets');
    expect(labels).toContain('Citas');
    expect(labels).toContain('Citas/pub');
    expect(labels).toContain('H-index');
    expect(labels).toContain('Coautores UTA');
    expect(labels).toContain('Acceso abierto');
    expect(labels.indexOf('Datasets')).toBe(labels.indexOf('Publicaciones') + 1);
    expect(cards.find((c) => c.key === 'datasets')?.display).toBe('0');
    expect(cards.find((c) => c.key === 'datasets')?.expandable).toBe(false);
    expect(cards.find((c) => c.key === 'cpp')?.display).toBe('24.0');
    expect(cards.find((c) => c.key === 'oa')?.display).toBe('50%');
  });

  it('marks datasets KPI expandable when count is positive', () => {
    const profile: CoAuthorProfile = {
      name: 'With data',
      works_count: 2,
      cited_by_count: 10,
      h_index: 1,
      works: [],
    };
    const ds = buildCoAuthorKpiCards(profile, 0, { datasetsCount: 3 }).find((c) => c.key === 'datasets');
    expect(ds?.expandable).toBe(true);
  });

  it('shows datasets loading placeholder in second position', () => {
    const profile: CoAuthorProfile = {
      name: 'Loading',
      works_count: 3,
      cited_by_count: 10,
      h_index: 2,
      works: [],
    };
    const cards = buildCoAuthorKpiCards(profile, 0, { datasetsLoading: true });
    expect(cards[1]).toEqual({ key: 'datasets', label: 'Datasets', display: '…', expandable: false });
  });

  it('always shows Datasets and Coautores UTA even when collaboration metrics are empty', () => {
    const profile: CoAuthorProfile = {
      name: 'External',
      works_count: 0,
      cited_by_count: 0,
      h_index: 0,
      works: [{ t: 'Global', c: 10, d: '10.1/a' }],
    };
    const cards = buildCoAuthorKpiCards(profile, 0, { datasetsCount: 0 });
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.key)).toEqual(['datasets', 'uta']);
    expect(cards.every((c) => !c.expandable)).toBe(true);
  });

  it('marks Coautores UTA KPI expandable when count is positive', () => {
    const profile: CoAuthorProfile = {
      name: 'Collab',
      works_count: 1,
      cited_by_count: 5,
      h_index: 1,
      works: [],
    };
    const uta = buildCoAuthorKpiCards(profile, 2, { datasetsCount: 0 }).find((c) => c.key === 'uta');
    expect(uta?.expandable).toBe(true);
    expect(uta?.display).toBe('2');
  });

  it('lists UTA collaborators from autores_uta RUTs (not fuzzy name)', () => {
    const works: Work[] = [
      {
        t: 'Joint',
        autores_uta: [utaLink('uta-1', '0000-0001-0000-0001', 'Ana UTA', 0)],
        a: ['Ana UTA', 'External'],
      },
      {
        t: 'Joint 2',
        autores_uta: [utaLink('uta-2', '0000-0002-0000-0002', 'Bruno UTA', 1)],
        a: ['Bruno UTA', 'External'],
      },
    ];
    const catalog: Researcher[] = [
      { id: 'uta-1', f: 'Ana', l: 'Silva', o: '0000-0001-0000-0001', t: 'Profesor' },
      { id: 'uta-2', f: 'Bruno', l: 'López', o: '0000-0002-0000-0002', t: 'Investigador' },
    ];
    expect(countUtaCoauthorsFromWorks(works)).toBe(2);
    const links = listUtaCollaboratorsFromWorks(works, catalog);
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.id).sort()).toEqual(['uta-1', 'uta-2']);
    expect(links[0].researcher?.f).toBe('Ana');
    expect(links[1].researcher?.l).toBe('López');
  });

  it('marks FWCI green when >= 1', () => {
    const profile: CoAuthorProfile = {
      name: 'Impactful',
      works_count: 2,
      cited_by_count: 50,
      h_index: 2,
      works: [
        { t: 'A', y: 2020, c: 20, impact: 1.4 },
        { t: 'B', y: 2019, c: 30, impact: 1.2 },
      ],
    };
    const fwci = buildCoAuthorKpiCards(profile, 1, { datasetsCount: 1 }).find((c) => c.key === 'fwci');
    expect(fwci?.display).toBe('1.30');
    expect(fwci?.positive).toBe(true);
  });
});
