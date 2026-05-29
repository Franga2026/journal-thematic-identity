import { describe, it, expect } from 'vitest';
import { aggregateAuthorsFromWorks } from '../services/sdg/aggregateAuthors';
import type { OpenAlexWorkResult } from '../services/sdg/openAlexTypes';

const WORKS: OpenAlexWorkResult[] = [
  {
    id: 'https://openalex.org/W1',
    cited_by_count: 50,
    authorships: [
      {
        author: {
          id: 'https://openalex.org/A100',
          display_name: 'Ana Global',
          orcid: 'https://orcid.org/0000-0001-1111-1111',
        },
        institutions: [
          { id: 'https://openalex.org/I1', display_name: 'MIT', country_code: 'US' },
        ],
        countries: ['US'],
      },
      {
        author: {
          id: 'https://openalex.org/A200',
          display_name: 'Luis Ibero',
        },
        institutions: [
          {
            id: 'https://openalex.org/I2',
            display_name: 'Universidad de Chile',
            country_code: 'CL',
          },
        ],
        countries: ['CL'],
      },
    ],
  },
  {
    id: 'https://openalex.org/W2',
    cited_by_count: 10,
    authorships: [
      {
        author: {
          id: 'https://openalex.org/A200',
          display_name: 'Luis Ibero',
        },
        institutions: [
          {
            id: 'https://openalex.org/I2',
            display_name: 'Universidad de Chile',
            country_code: 'CL',
          },
        ],
        countries: ['CL'],
      },
    ],
  },
];

describe('aggregateAuthorsFromWorks', () => {
  it('groups by author id and deduplicates', () => {
    const global = aggregateAuthorsFromWorks(WORKS, 10, 'global');
    expect(global).toHaveLength(2);
    const luis = global.find((a) => a.author_openalex_id === 'A200');
    expect(luis?.publications_count).toBe(2);
    expect(luis?.citations_count).toBe(60);
  });

  it('filters iberoamerica by country', () => {
    const ibero = aggregateAuthorsFromWorks(WORKS, 10, 'iberoamerica');
    expect(ibero.some((a) => a.author_openalex_id === 'A200')).toBe(true);
    expect(ibero.some((a) => a.author_openalex_id === 'A100')).toBe(false);
  });
});
