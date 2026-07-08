import { describe, it, expect } from 'vitest';
import {
  enrichAuthors,
  hasUtaAuthor,
  utaLeadershipLabel,
} from '../services/discovery/enrichUniversalAuthors';
import type { WorkAuthor } from '../services/discovery/universalSearch';
import type { Researcher } from '../shared/types';

const CATALOG: Researcher[] = [
  { id: '12345678-9', f: 'Francisco', l: 'Rothhammer Engel', o: '0000-0001-5228-1180' },
];

describe('enrichUniversalAuthors', () => {
  it('utaLeadershipLabel maps OpenAlex positions', () => {
    expect(utaLeadershipLabel('first')).toBe('Primer autor');
    expect(utaLeadershipLabel('last')).toBe('Autor senior');
    expect(utaLeadershipLabel('middle')).toBeNull();
  });

  it('enrichAuthors marks UTA when author_id matches orcid-authorid-map', () => {
    const authors: WorkAuthor[] = [
      { name: 'Externo', author_id: 'A9999999999', orcid: null, position: 'first' },
      { name: 'Francisco Rothhammer', author_id: 'A5022063392', orcid: '0000-0001-5228-1180', position: 'last' },
    ];
    const enriched = enrichAuthors(authors, CATALOG);
    expect(enriched[0].utaResearcher).toBeNull();
    expect(enriched[1].utaResearcher?.l).toMatch(/Rothhammer/i);
    expect(hasUtaAuthor(enriched)).toBe(true);
  });
});
