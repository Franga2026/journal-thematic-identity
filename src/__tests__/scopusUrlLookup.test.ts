import { describe, it, expect, beforeEach } from 'vitest';
import {
  normIssnHyphenated,
  buildScopusUrl,
  buildScopusUrlByIssn,
  buildScopusUrlByTitle,
  getScopusUrl,
  isScopusIndexed,
  isScopusIndexedByUrl,
  getScopusUrlFromIssns,
  setScopusUrlIndexForTests,
  SCOPUS_OPENURL_BASE,
} from '../utils/scopusUrlLookup';

const EXPECTED_0366 =
  'https://www.scopus.com/scopus/openurl/link.url' +
  '?ctx_ver=Z39.88-2004' +
  '&ctx_enc=info:ofi/enc:UTF-8' +
  '&svc_val_fmt=info:ofi/fmt:kev:mtx:sch_svc' +
  '&svc.source=yes' +
  '&rft_val_fmt=info:ofi/fmt:kev:mtx:journal' +
  '&rft.issn=0366-0826';

describe('scopusUrlLookup', () => {
  beforeEach(() => {
    setScopusUrlIndexForTests({
      byIssn: ['0366-0826'],
      byTitle: { '2076-3425': 'Brain+Sciences' },
    });
  });

  it('normIssnHyphenated normaliza a XXXX-XXXX', () => {
    expect(normIssnHyphenated('0366-0826')).toBe('0366-0826');
    expect(normIssnHyphenated('03660826')).toBe('0366-0826');
    expect(normIssnHyphenated('  2076-3425  ')).toBe('2076-3425');
    expect(normIssnHyphenated('123')).toBe(null);
    expect(normIssnHyphenated(null)).toBe(null);
  });

  it('buildScopusUrl usa OpenURL completa del KBART (ctx_ver + svc.source)', () => {
    expect(buildScopusUrlByIssn('0366-0826')).toBe(EXPECTED_0366);
    expect(buildScopusUrl('0366-0826')).toBe(EXPECTED_0366);
    expect(buildScopusUrl('0366-0826')).toContain('ctx_ver=Z39.88-2004');
    expect(buildScopusUrl('0366-0826')).toContain('svc.source=yes');
    expect(buildScopusUrl('0366-0826')).not.toContain('svc.citedby');
    expect(buildScopusUrlByTitle('Brain+Sciences')).toBe(
      `${SCOPUS_OPENURL_BASE}&rft.title=Brain+Sciences`,
    );
  });

  it('getScopusUrl resuelve por ISSN o por título según el índice v2', () => {
    expect(getScopusUrl('0366-0826')).toBe(EXPECTED_0366);
    expect(getScopusUrl('03660826')).toContain('rft.issn=0366-0826');
    expect(getScopusUrl('2076-3425')).toBe(
      `${SCOPUS_OPENURL_BASE}&rft.title=Brain+Sciences`,
    );
    expect(getScopusUrl('9999-9999')).toBe(null);
    expect(isScopusIndexed('2076-3425')).toBe(true);
    expect(isScopusIndexedByUrl('0000-0000')).toBe(false);
  });

  it('getScopusUrlFromIssns toma el primero con match', () => {
    expect(getScopusUrlFromIssns(['9999-9999', '2076-3425'])).toContain(
      'rft.title=Brain+Sciences',
    );
    expect(getScopusUrlFromIssns([null, 'nope'])).toBe(null);
  });

  it('sin índice cargado / override null → null', () => {
    setScopusUrlIndexForTests(null);
    expect(getScopusUrl('0366-0826')).toBe(null);
  });

  it('compat v1: array de ISSN → todos por rft.issn', () => {
    setScopusUrlIndexForTests(['0366-0826', '2076-3425']);
    expect(getScopusUrl('2076-3425')).toContain('rft.issn=2076-3425');
  });
});
