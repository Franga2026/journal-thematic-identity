import { describe, it, expect } from 'vitest';
import {
  sortResearchersByPerfilesOrder,
  sortSdgRowsByPerfilesOrder,
} from '../utils/perfilesOrder';
import type { Researcher } from '../shared/types';

const CATALOG: Researcher[] = [
  { id: 'aaa', f: 'Zoe', l: 'Zeta' },
  { id: 'bbb', f: 'Ana', l: 'Alfa' },
];

describe('perfilesOrder', () => {
  it('sortResearchersByPerfilesOrder follows catalog order', () => {
    const shuffled = [CATALOG[1], CATALOG[0]];
    const sorted = sortResearchersByPerfilesOrder(shuffled, CATALOG);
    expect(sorted.map((r) => r.id)).toEqual(['aaa', 'bbb']);
  });

  it('sortSdgRowsByPerfilesOrder uses uta_researcher_id', () => {
    const rows = [
      { uta_researcher_id: 'bbb', orcid: undefined },
      { uta_researcher_id: 'aaa', orcid: undefined },
    ];
    const sorted = sortSdgRowsByPerfilesOrder(rows, CATALOG);
    expect(sorted.map((r) => r.uta_researcher_id)).toEqual(['aaa', 'bbb']);
  });
});
