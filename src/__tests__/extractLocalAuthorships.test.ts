import { describe, it, expect } from 'vitest';
import {
  buildResearcherIndex,
  extractAuthorshipsFromWork,
} from '../services/sdg/extractLocalAuthorships';
import type { Researcher, Work } from '../shared/types';

const RESEARCHERS: Researcher[] = [
  { id: '111', f: 'Ana', l: 'Silva', o: '0000-0001-1111-1111' },
];

describe('extractLocalAuthorships', () => {
  const index = () => buildResearcherIndex(RESEARCHERS);

  it('falls back from authorships to autores_uta to a[]', () => {
    const fromA: Work = {
      sdgs: ['Climate action'],
      a: ['Ana Silva', 'John Doe'],
    };
    const list = extractAuthorshipsFromWork(fromA, index());
    expect(list.some((a) => a.authorName.includes('Ana'))).toBe(true);
    expect(list.some((a) => a.authorName.includes('John'))).toBe(true);
  });

  it('reads structured authorships when present', () => {
    const work: Work = {
      sdgs: ['Climate action'],
      authorships: [
        {
          author: { id: 'https://openalex.org/A99', display_name: 'Structured Author' },
          institutions: [{ display_name: 'U Chile', country_code: 'CL' }],
          countries: ['CL'],
        },
      ],
    };
    const list = extractAuthorshipsFromWork(work, index());
    expect(list[0].authorKey).toBe('A99');
    expect(list[0].countryCodes).toContain('CL');
  });
});
