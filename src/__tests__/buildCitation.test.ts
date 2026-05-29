import { describe, it, expect } from 'vitest';
import type { Work } from '../shared/types';
import {
  buildCitation,
  buildAllCitations,
  buildBibtexCitation,
  buildRisCitation,
} from '../utils/citation/buildCitation';
import { normalizeCitationMeta, parseAuthorName } from '../utils/citation/normalizeCitationMeta';
import { getWorkCitationId } from '../utils/citation/workCitationId';

const FULL_WORK: Work = {
  t: 'Quantum effects in nanostructures',
  y: 2023,
  s: 'Nature Physics',
  tp: 'article',
  d: '10.1038/s41567-023-01234-5',
  u: 'https://doi.org/10.1038/s41567-023-01234-5',
  ou: 'https://example.org/paper.pdf',
  a: ['Ana Silva', 'Luis Rojas'],
  vol: '19',
  issue: '4',
  pages: '112-118',
};

describe('buildCitation', () => {
  it('parseAuthorName Apellido, Iniciales', () => {
    const p = parseAuthorName('Ana Silva');
    expect(p.apa).toBe('Silva, A.');
    expect(p.ieee).toContain('Silva');
  });

  it('generates APA with authors, year, title, journal and DOI', () => {
    const apa = buildCitation(FULL_WORK, 'apa');
    expect(apa).toContain('Silva, A.');
    expect(apa).toContain('(2023)');
    expect(apa).toContain('Quantum effects in nanostructures');
    expect(apa).toContain('Nature Physics');
    expect(apa).toContain('10.1038/s41567-023-01234-5');
  });

  it('generates IEEE', () => {
    const ieee = buildCitation(FULL_WORK, 'ieee');
    expect(ieee).toContain('"Quantum effects in nanostructures,"');
    expect(ieee).toContain('Nature Physics');
    expect(ieee).toContain('vol. 19');
    expect(ieee).toContain('2023');
  });

  it('generates valid BibTeX', () => {
    const bib = buildCitation(FULL_WORK, 'bibtex');
    expect(bib).toMatch(/^@article\{[\w-]+,/);
    expect(bib).toContain('author = {');
    expect(bib).toContain('doi = {10.1038/s41567-023-01234-5}');
    expect(bib).toContain('}');
  });

  it('generates valid RIS', () => {
    const ris = buildCitation(FULL_WORK, 'ris');
    expect(ris).toContain('TY  - JOUR');
    expect(ris).toContain('AU  -');
    expect(ris).toContain('TI  - Quantum effects in nanostructures');
    expect(ris).toContain('ER  -');
  });

  it('works without DOI', () => {
    const work: Work = { ...FULL_WORK, d: undefined, u: 'https://example.org/p' };
    const apa = buildCitation(work, 'apa');
    expect(apa).toContain('2023');
    expect(apa).not.toContain('doi.org');
  });

  it('works with incomplete authors using title and year', () => {
    const work: Work = { t: 'Solo título', y: 2021, s: 'Rev X' };
    const meta = normalizeCitationMeta(work);
    expect(meta.incomplete).toBe(false);
    const apa = buildCitation(work, 'apa');
    expect(apa).toContain('Solo título');
    expect(apa).toContain('2021');
  });

  it('marks incomplete when missing critical data', () => {
    const work: Work = { a: ['Ana Silva'] };
    const all = buildAllCitations(work);
    expect(all.incomplete).toBe(true);
    expect(all.apa).toContain('Cita incompleta');
  });

  it('does not strip access fields from original work', () => {
    const work: Work = {
      ...FULL_WORK,
      ou: 'https://example.org/paper.pdf',
      openalex_id: 'W123456789',
    };
    buildAllCitations(work);
    expect(work.ou).toBe('https://example.org/paper.pdf');
    expect(work.openalex_id).toBe('W123456789');
    expect(work.d).toBe(FULL_WORK.d);
  });

  it('getWorkCitationId prefers DOI', () => {
    expect(getWorkCitationId(FULL_WORK)).toBe('doi:10.1038/s41567-023-01234-5');
  });

  it('buildBibtexCitation and buildRisCitation via meta', () => {
    const meta = normalizeCitationMeta(FULL_WORK);
    expect(buildBibtexCitation(meta)).toContain('@article');
    expect(buildRisCitation(meta)).toContain('TY  - JOUR');
  });
});
