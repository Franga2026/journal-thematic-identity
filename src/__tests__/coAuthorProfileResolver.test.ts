import { describe, it, expect, beforeAll } from 'vitest';
import { initData } from '../utils/dataProcessing';
import {
  getCoAuthorClickTarget,
  isCoAuthorClickable,
  lookupCoAuthorRawProfile,
  resolveCoAuthorFromRef,
} from '../utils/coAuthorProfileResolver';
import type { Researcher } from '../shared/types';

const RESEARCHERS: Researcher[] = [
  { id: '11.111.111-1', f: 'Ana', l: 'UTA', o: '0000-0001-1111-1111' },
];

beforeAll(() => {
  initData({
    DATA: RESEARCHERS,
    OA: { authors: {} },
    AW: [
      {
        t: 'Joint paper',
        a: ['Ana UTA', 'Bob External'],
        autores_uta: ['11.111.111-1'],
      },
    ],
    OD: { profiles: {} },
    AI: {},
    COAUTHORS: {
      '0000-0002-2222-2222': {
        name: 'Bob External',
        orcid: '0000-0002-2222-2222',
        oaId: 'https://openalex.org/A999',
        works: [],
      },
    },
    METRICS: { researcher_distributions: {} },
    RES_METRICS: {},
    CITATIONS: {},
  });
});

describe('coAuthorProfileResolver', () => {
  it('finds coauthor by cleaned ORCID key', () => {
    const raw = lookupCoAuthorRawProfile({
      name: 'Bob',
      orcid: 'https://orcid.org/0000-0002-2222-2222',
      count: 1,
    });
    expect(raw?.name).toBe('Bob External');
  });

  it('finds coauthor by OpenAlex id when ORCID is empty', () => {
    const raw = lookupCoAuthorRawProfile({
      name: 'Bob External',
      orcid: '',
      oaId: 'https://openalex.org/A999',
      count: 3,
    });
    expect(raw?.orcid).toBe('0000-0002-2222-2222');
  });

  it('builds fallback profile from name when not in catalog', () => {
    const profile = resolveCoAuthorFromRef({
      name: 'Unknown Author',
      oaId: 'https://openalex.org/A123',
      count: 1,
    });
    expect(profile?.name).toBe('Unknown Author');
  });

  it('opens UTA researcher when coauthor is in data.json', () => {
    const target = getCoAuthorClickTarget({
      name: 'Ana UTA',
      orcid: '0000-0001-1111-1111',
      count: 2,
    });
    expect(target?.kind).toBe('uta');
    if (target?.kind === 'uta') {
      expect(target.researcher.f).toBe('Ana');
    }
  });

  it('isCoAuthorClickable is true for ORCID and oaId-only refs', () => {
    expect(
      isCoAuthorClickable({ name: 'Bob', orcid: '0000-0002-2222-2222', count: 1 })
    ).toBe(true);
    expect(
      isCoAuthorClickable({ name: 'Bob', orcid: '', oaId: 'https://openalex.org/A999', count: 1 })
    ).toBe(true);
  });
});
