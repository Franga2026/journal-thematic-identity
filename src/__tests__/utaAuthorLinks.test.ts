import { describe, it, expect } from 'vitest';
import type { Researcher, Work } from '../shared/types';
import {
  buildUtaLinksFromAuthorships,
  matchAuthorToUtaLink,
} from '../utils/utaAuthorLinks';
import { utaLink } from './utaLinkFixtures';
import type { OrcidAuthorIdMapFile } from '../utils/orcidAuthorIdMap';

const CATALOG: Researcher[] = [
  { id: '07177740-5', f: 'Bernardo', l: 'Arriaza Torres', o: '0000-0001-9921-9253' },
  { id: '08243585-9', f: 'Vivien', l: 'Standen Ramírez', o: '' },
  { id: '27952891-3', f: 'Adriano', l: 'Joao Da Silva', o: '0000-0003-3306-0141' },
  { id: '16080784-9', f: 'Claudia', l: 'Correa', o: '0000-0001-2345-6789' },
];

const TEST_MAP: OrcidAuthorIdMapFile = {
  map: {
    '0000-0001-9921-9253': ['A5080782092'],
    '0000-0003-3306-0141': ['A2795289100'],
    '0000-0001-2345-6789': ['A1608078400'],
    '0000-0002-1234-5678': ['A0824358500'],
  },
};

describe('utaAuthorLinks author.id', () => {
  it('links Arriaza when authorship has author.id but orcid null', () => {
    const work: Work = {
      a: ['Bernardo Arriaza', 'Arnoldo Vizcarra'],
      authorships: [
        { author: { id: 'https://openalex.org/A5080782092', display_name: 'Bernardo Arriaza', orcid: null } },
        { author: { display_name: 'Arnoldo Vizcarra', orcid: null } },
      ],
    };
    const links = buildUtaLinksFromAuthorships(work, CATALOG, TEST_MAP);
    expect(links).toHaveLength(1);
    expect(links[0].rut).toBe('07177740-5');
    expect(links[0].author_id).toBe('A5080782092');
    const linked = { ...work, autores_uta: links };
    expect(matchAuthorToUtaLink(linked, 'Bernardo Arriaza', 0, CATALOG)?.link.rut).toBe('07177740-5');
  });

  it('does NOT link Ariany to Adriano (Ariany not in UTA author.id set)', () => {
    const work: Work = {
      a: ['Ariany da Silva Villar', 'Adriano Joao Da Silva'],
      authorships: [
        { author: { id: 'https://openalex.org/A9999999999', display_name: 'Ariany da Silva Villar', orcid: null } },
        { author: { id: 'https://openalex.org/A2795289100', display_name: 'Adriano Joao Da Silva', orcid: 'https://orcid.org/0000-0003-3306-0141' } },
      ],
      autores_uta: [utaLink('27952891-3', '0000-0003-3306-0141', 'Adriano Joao Da Silva', 1, 'A2795289100')],
    };
    expect(matchAuthorToUtaLink(work, 'Ariany da Silva Villar', 0, CATALOG)).toBeNull();
    expect(matchAuthorToUtaLink(work, 'Adriano Joao Da Silva', 1, CATALOG)?.link.rut).toBe('27952891-3');
  });

  it('does NOT link Felipe Ponce-Correa to Claudia without UTA author.id on Felipe', () => {
    const work: Work = {
      a: ['Felipe Ponce-Correa', 'Claudia Correa'],
      authorships: [
        { author: { id: 'https://openalex.org/A8888888888', display_name: 'Felipe Ponce-Correa', orcid: null } },
        { author: { id: 'https://openalex.org/A1608078400', display_name: 'Claudia Correa', orcid: 'https://orcid.org/0000-0001-2345-6789' } },
      ],
      autores_uta: [utaLink('16080784-9', '0000-0001-2345-6789', 'Claudia Correa', 1, 'A1608078400')],
    };
    expect(matchAuthorToUtaLink(work, 'Felipe Ponce-Correa', 0, CATALOG)).toBeNull();
  });

  it('does NOT link Standen without ORCID in catalog (no author.id in cache)', () => {
    const work: Work = {
      a: ['Vivien Standen'],
      authorships: [
        { author: { id: 'https://openalex.org/A5136789081', display_name: 'Vivien Standen', orcid: null } },
      ],
    };
    const links = buildUtaLinksFromAuthorships(work, CATALOG, TEST_MAP);
    expect(links).toHaveLength(0);
  });

  it('requires exact display_name match at author_index', () => {
    const work: Work = {
      a: ['Bernardo Arriaza'],
      autores_uta: [utaLink('07177740-5', '0000-0001-9921-9253', 'Bernardo Arriaza Torres', 0, 'A5080782092')],
    };
    expect(matchAuthorToUtaLink(work, 'Bernardo Arriaza', 0, CATALOG)).toBeNull();
  });
});
