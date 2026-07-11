import { describe, it, expect, beforeEach } from 'vitest';
import {
  normIssnHyphenated,
  buildScopusUrl,
  getScopusUrl,
  isScopusIndexedByUrl,
  getScopusUrlFromIssns,
  setScopusUrlIndexForTests,
  SCOPUS_ISSN_URL_TEMPLATE,
} from '../utils/scopusUrlLookup';

describe('scopusUrlLookup', () => {
  beforeEach(() => {
    setScopusUrlIndexForTests(['0366-0826', '2076-3425']);
  });

  it('normIssnHyphenated normaliza a XXXX-XXXX', () => {
    expect(normIssnHyphenated('0366-0826')).toBe('0366-0826');
    expect(normIssnHyphenated('03660826')).toBe('0366-0826');
    expect(normIssnHyphenated('  2076-3425  ')).toBe('2076-3425');
    expect(normIssnHyphenated('123')).toBe(null);
    expect(normIssnHyphenated(null)).toBe(null);
  });

  it('buildScopusUrl usa la plantilla cited-by', () => {
    expect(buildScopusUrl('0366-0826')).toBe(
      `${SCOPUS_ISSN_URL_TEMPLATE}0366-0826`,
    );
    expect(buildScopusUrl('0366-0826')).toBe(
      'https://www.scopus.com/scopus/openurl/link.url?svc.citedby=1&rft.issn=0366-0826',
    );
  });

  it('getScopusUrl resuelve print u online', () => {
    expect(getScopusUrl('0366-0826')).toContain('rft.issn=0366-0826');
    expect(getScopusUrl('03660826')).toContain('rft.issn=0366-0826');
    expect(getScopusUrl('9999-9999')).toBe(null);
    expect(isScopusIndexedByUrl('2076-3425')).toBe(true);
    expect(isScopusIndexedByUrl('0000-0000')).toBe(false);
  });

  it('getScopusUrlFromIssns toma el primero con match', () => {
    expect(getScopusUrlFromIssns(['9999-9999', '2076-3425'])).toContain(
      'rft.issn=2076-3425',
    );
    expect(getScopusUrlFromIssns([null, 'nope'])).toBe(null);
  });

  it('sin índice cargado devuelve null', () => {
    setScopusUrlIndexForTests(null);
    expect(getScopusUrl('0366-0826')).toBe(null);
  });
});
