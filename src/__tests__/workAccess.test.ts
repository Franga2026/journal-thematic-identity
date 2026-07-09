import { describe, it, expect } from 'vitest';
import {
  getWorkAccessUrl,
  getWorkNavigationUrl,
  getWorkResourceLinks,
  mergeWorkLinkMetadata,
  mergeWorksWithCatalog,
  normalizeWorkFields,
} from '../utils/workAccess';
import type { Work } from '../shared/types';

describe('workAccess', () => {
  it('normalizeWorkFields maps title and open_access aliases', () => {
    const w = normalizeWorkFields({
      title: 'Paper X',
      cited_by_count: 12,
      open_access: { is_oa: true, oa_url: 'https://example.com/pdf' },
    });
    expect(w.t).toBe('Paper X');
    expect(w.c).toBe(12);
    expect(w.oa).toBe(true);
    expect(w.ou).toBe('https://example.com/pdf');
  });

  it('getWorkAccessUrl prefers OA URL then DOI', () => {
    expect(getWorkAccessUrl({ ou: 'https://oa.test/pdf' })).toBe('https://oa.test/pdf');
    expect(getWorkAccessUrl({ d: '10.1234/abc' })).toBe('https://doi.org/10.1234/abc');
    expect(getWorkAccessUrl({ d: 'https://doi.org/10.1234/abc' })).toBe('https://doi.org/10.1234/abc');
    expect(getWorkAccessUrl({ openalex_id: 'W123' })).toBe('https://openalex.org/W123');
  });

  it('mergeWorkLinkMetadata fills missing links from catalog entry', () => {
    const local: Work = { t: 'Joint paper', y: 2020, c: 10 };
    const catalog: Work = {
      t: 'Joint paper',
      d: '10.4067/test',
      ou: 'http://example.com/paper.pdf',
      oa: true,
    };
    const merged = mergeWorkLinkMetadata(local, catalog);
    expect(merged.d).toBe('10.4067/test');
    expect(merged.ou).toBe('http://example.com/paper.pdf');
    expect(merged.oa).toBe(true);
  });

  it('mergeWorksWithCatalog matches by DOI', () => {
    const locals: Work[] = [{ t: 'A', c: 5, d: '10.1234/a' }];
    const catalog: Work[] = [{ t: 'A full', d: 'https://doi.org/10.1234/a', ou: 'https://pdf.test' }];
    const out = mergeWorksWithCatalog(locals, catalog);
    expect(out[0].ou).toBe('https://pdf.test');
  });

  it('getWorkResourceLinks exposes PDF, DOI and OpenAlex when available', () => {
    const links = getWorkResourceLinks({
      pdf_url: 'https://repo.test/paper.pdf',
      d: '10.1234/abc',
      u: 'https://journal.test/article',
      open_access: { oa_url: 'https://oa.test/landing' },
      openalex_id: 'W999',
    });
    expect(links.map((l) => l.key)).toEqual(['pdf', 'doi', 'landing', 'oa', 'openalex']);
    expect(links[0].href).toBe('https://repo.test/paper.pdf');
    expect(links[1].href).toBe('https://doi.org/10.1234/abc');
  });

  it('getWorkNavigationUrl falls back to Scholar', () => {
    expect(getWorkNavigationUrl({ t: 'Quantum dots' })).toContain('scholar.google.com');
    expect(getWorkNavigationUrl({})).toBeNull();
  });
});
