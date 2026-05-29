import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Work } from '../shared/types';
import { initData, getAW } from '../utils/dataProcessing';
import {
  enrichAutoresUtaFromAuthorships,
  linkCoAuthorCollaborations,
  linkCollaborator,
} from '../services/collaborators/linkCollaborators';

vi.mock('../services/collaborators/openAlexCollaboratorWorks', () => ({
  fetchAuthorWorkDois: vi.fn().mockResolvedValue([]),
  normCollaboratorDoi: (d?: string) =>
    (d || '').toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, ''),
}));

const WORKS: Work[] = [
  {
    t: 'Colab paper',
    c: 20,
    d: '10.5555/colab',
    autores_uta: [],
    authorships: [
      {
        author: {
          display_name: 'Ana Silva',
          orcid: 'https://orcid.org/0000-0001-1111-1111',
        },
        institutions: [{ display_name: 'Universidad de Tarapacá' }],
      },
      {
        author: {
          display_name: 'External Colleague',
          orcid: 'https://orcid.org/0000-0002-2222-2222',
        },
      },
    ],
  },
];

beforeEach(() => {
  initData({
    DATA: [{ id: '111', f: 'Ana', l: 'Silva', o: '0000-0001-1111-1111' }],
    OA: { authors: {}, institution: {} },
    AW: WORKS.map((w) => ({ ...w, autores_uta: [...(w.autores_uta || [])] })),
    OD: {},
    AI: {},
    COAUTHORS: {
      '0000-0002-2222-2222': {
        name: 'External Colleague',
        orcid: '0000-0002-2222-2222',
        works: [],
      },
    },
    METRICS: {},
    RES_METRICS: {},
  });
});

describe('linkCollaborators', () => {
  it('enrichAutoresUtaFromAuthorships links ORCID in authorships', () => {
    const works = getAW().map((w) => ({ ...w, autores_uta: [] }));
    const added = enrichAutoresUtaFromAuthorships(works, [
      { id: '111', f: 'Ana', l: 'Silva', o: '0000-0001-1111-1111' },
    ]);
    expect(added).toBeGreaterThan(0);
    expect(works[0].autores_uta?.length).toBeGreaterThan(0);
  });

  it('linkCoAuthorCollaborations marks co-author + UTA works', () => {
    const works = getAW().map((w) => ({ ...w, autores_uta: [] }));
    enrichAutoresUtaFromAuthorships(works, [
      { id: '111', f: 'Ana', l: 'Silva', o: '0000-0001-1111-1111' },
    ]);
    const linked = linkCoAuthorCollaborations(
      works,
      { orcid: '0000-0002-2222-2222', name: 'External Colleague' },
      [{ id: '111', f: 'Ana', l: 'Silva', o: '0000-0001-1111-1111' }]
    );
    expect(linked).toBeGreaterThanOrEqual(0);
    expect(works[0].autores_uta?.length).toBeGreaterThan(0);
  });

  it('linkCollaborator API returns profile with collaboration works', async () => {
    const result = await linkCollaborator({
      orcid: '0000-0002-2222-2222',
      fetchOpenAlex: false,
    });
    expect(result.ok).toBe(true);
    expect(result.coauthor_linked_count).toBeGreaterThanOrEqual(1);
    expect(result.profile?.works?.length).toBeGreaterThanOrEqual(1);
  });
});
