import { describe, it, expect, beforeEach } from 'vitest';
import type { Work } from '../shared/types';
import { initData } from '../utils/dataProcessing';
import {
  buildResearcherMetrics,
  collectCollaborationWorksForCoAuthor,
  dedupeWorks,
  resolveCoAuthorProfile,
  workIncludesCoAuthor,
  METRICS_SCOPE_LABELS,
} from '../utils/researcherMetrics';

const MOCK_WORKS: Work[] = [
  {
    t: 'Joint paper A',
    c: 50,
    field: 'Genetics',
    d: '10.1234/a',
    autores_uta: ['uta-1'],
    a: ['Ana UTA', 'Andres Ruiz-Linares'],
  },
  {
    t: 'Joint paper B',
    c: 30,
    field: 'Genetics',
    d: '10.1234/b',
    autores_uta: ['uta-1'],
    authorships: [
      {
        author: { display_name: 'Ana UTA', orcid: 'https://orcid.org/0000-0001-0000-0001' },
      },
      {
        author: {
          display_name: 'Andrés Ruiz-Linares',
          orcid: 'https://orcid.org/0000-0001-8372-1011',
          id: 'https://openalex.org/A123',
        },
      },
    ],
  },
  {
    t: 'Global only',
    c: 1000,
    autores_uta: [],
    a: ['Andres Ruiz-Linares'],
  },
  {
    t: 'Joint paper A',
    c: 50,
    d: '10.1234/a',
    autores_uta: ['uta-1'],
    a: ['Ana UTA', 'Andres Ruiz-Linares'],
  },
];

beforeEach(() => {
  initData({
    DATA: [{ id: 'uta-1', f: 'Ana', l: 'UTA', o: '0000-0001-0000-0001' }],
    OA: { authors: {}, institution: {} },
    AW: MOCK_WORKS,
    OD: {},
    AI: {},
    COAUTHORS: {},
    METRICS: {},
    RES_METRICS: {},
  });
});

describe('researcherMetrics', () => {
  it('dedupeWorks by DOI', () => {
    expect(dedupeWorks(MOCK_WORKS).length).toBe(3);
  });

  it('workIncludesCoAuthor matches ORCID and name', () => {
    const profile = { name: 'Andrés Ruiz-Linares', orcid: '0000-0001-8372-1011', oaId: 'A123' };
    expect(workIncludesCoAuthor(MOCK_WORKS[0], profile)).toBe(true);
    expect(workIncludesCoAuthor(MOCK_WORKS[1], profile)).toBe(true);
    expect(workIncludesCoAuthor(MOCK_WORKS[2], profile)).toBe(true);
  });

  it('collectCollaborationWorksForCoAuthor only UTA-linked works', () => {
    const profile = { name: 'Andrés Ruiz-Linares', orcid: '0000-0001-8372-1011' };
    const works = collectCollaborationWorksForCoAuthor(profile, MOCK_WORKS);
    expect(works.length).toBe(2);
    expect(works.every((w) => (w.autores_uta || []).length > 0)).toBe(true);
  });

  it('buildResearcherMetrics computes h-index from local citations', () => {
    const metrics = buildResearcherMetrics({
      scope: 'collaboration',
      publications: MOCK_WORKS.filter((w) => (w.autores_uta || []).length),
    });
    expect(metrics.publicationsCount).toBe(2);
    expect(metrics.citationsCount).toBe(80);
    expect(metrics.hIndex).toBe(2);
    expect(metrics.metricsScope).toBe('collaboration');
  });

  it('resolveCoAuthorProfile replaces global header with collaboration metrics', () => {
    const resolved = resolveCoAuthorProfile({
      name: 'Andrés Ruiz-Linares',
      orcid: '0000-0001-8372-1011',
      works_count: 265,
      cited_by_count: 58769,
      h_index: 60,
      fields: ['Global Field'],
      works: [{
        t: 'Joint paper B',
        y: 2020,
        c: 30,
        d: 'https://doi.org/10.1234/b',
        ou: 'http://example.com/joint.pdf',
        oa: true,
      }],
    });
    expect(resolved!.works_count).toBe(2);
    expect(resolved!.cited_by_count).toBe(80);
    expect(resolved!.h_index).toBe(2);
    expect(resolved!.metricsScope).toBe('collaboration');
    expect(resolved!.global_openalex?.works_count).toBe(265);
    expect(resolved!.global_openalex?.h_index).toBe(60);
    expect(resolved!.works?.length).toBe(2);
    const joint = resolved!.works!.find((w) => (w.t || '').includes('Joint paper B'));
    expect(joint?.ou).toBe('http://example.com/joint.pdf');
    expect(joint?.d).toContain('10.1234/b');
  });

  it('falls back to global catalog when no local collaboration works', () => {
    initData({
      DATA: [],
      OA: { authors: {}, institution: {} },
      AW: [],
      OD: {},
      AI: {},
      COAUTHORS: {},
      METRICS: {},
      RES_METRICS: {},
    });
    const resolved = resolveCoAuthorProfile({
      name: 'External Author',
      orcid: '0000-0009-9999-9999',
      works_count: 50,
      cited_by_count: 1000,
      h_index: 15,
      works: [
        { t: 'Global paper 1', c: 100, d: '10.9999/a', ou: 'https://example.com/a.pdf', oa: true },
        { t: 'Global paper 2', c: 50, d: '10.9999/b' },
      ],
    });
    expect(resolved!.works_count).toBe(0);
    expect(resolved!.publicationListScope).toBe('global_openalex');
    expect(resolved!.works?.length).toBe(2);
    expect(resolved!.works![0].ou).toBe('https://example.com/a.pdf');
  });

  it('METRICS_SCOPE_LABELS are defined', () => {
    expect(METRICS_SCOPE_LABELS.collaboration).toContain('UTA');
    expect(METRICS_SCOPE_LABELS.global_openalex).toContain('OpenAlex');
  });
});
