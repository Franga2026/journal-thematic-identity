import { describe, it, expect } from 'vitest';
import { aggregateQuartilesFromWorks } from '../utils/localQuartileProfile';
import { makeGetQuartile } from '../utils/quartileIndex';
import type { Work } from '../shared/types';
import { utaLink } from './utaLinkFixtures';

describe('aggregateQuartilesFromWorks', () => {
  const map = new Map([
    ['12345678', 'Q1' as const],
    ['87654321', 'Q2' as const],
  ]);
  const getQuartile = makeGetQuartile(map);
  const idToOrcid = new Map([
    ['uta-1', '0000-0001-1111-1111'],
    ['0000-0001-1111-1111', '0000-0001-1111-1111'],
    ['uta-2', '0000-0002-2222-2222'],
  ]);
  const authorOrcids = new Set(['0000-0001-1111-1111', '0000-0002-2222-2222']);

  const works: Work[] = [
    {
      cr_issn: ['1234-5678'],
      autores_uta: [utaLink('uta-1', '0000-0001-1111-1111', 'Author 1', 0)],
    },
    {
      up_issn: '8765-4321',
      autores_uta: [
        utaLink('uta-1', '0000-0001-1111-1111', 'Author 1', 0),
        utaLink('uta-2', '0000-0002-2222-2222', 'Author 2', 1),
      ],
    },
    {
      cr_issn: ['9999-9999'],
      autores_uta: [utaLink('uta-1', '0000-0001-1111-1111', 'Author 1', 0)],
    },
  ];

  it('atribuye cuartiles deduplicando por ORCID en la misma obra', () => {
    const tallies = aggregateQuartilesFromWorks(works, getQuartile, idToOrcid, authorOrcids);
    expect(tallies.get('0000-0001-1111-1111')).toEqual({ Q1: 1, Q2: 1, Q3: 0, Q4: 0 });
    expect(tallies.get('0000-0002-2222-2222')).toEqual({ Q1: 0, Q2: 1, Q3: 0, Q4: 0 });
  });
});
