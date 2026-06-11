import { describe, it, expect } from 'vitest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  normIssn,
  buildScopusIssnSet,
  makeIsScopusIndexed,
  workJournalIssns,
} from '../utils/scopusIndex';

describe('scopusIndex', () => {
  it('normIssn normaliza guiones y mayúsculas', () => {
    expect(normIssn('1234-5678')).toBe('12345678');
    expect(normIssn('  abcd-efgh  ')).toBe('ABCDEFGH');
    expect(normIssn('123')).toBe('');
    expect(normIssn(null)).toBe('');
  });

  it('buildScopusIssnSet lee print y online del KBART', () => {
    const path = join(tmpdir(), `kbart-test-${Date.now()}.txt`);
    writeFileSync(
      path,
      [
        'title_id\tprint_identifier\tonline_identifier',
        'J1\t1234-5678\t8765-4321',
        'J2\t\tABCD-EFGH',
      ].join('\n'),
      'utf8',
    );
    try {
      const set = buildScopusIssnSet(path);
      expect(set.size).toBe(3);
      expect(set.has('12345678')).toBe(true);
      expect(set.has('87654321')).toBe(true);
      expect(set.has('ABCDEFGH')).toBe(true);
    } finally {
      unlinkSync(path);
    }
  });

  it('makeIsScopusIndexed y workJournalIssns', () => {
    const isIndexed = makeIsScopusIndexed(new Set(['12345678']));
    expect(
      isIndexed(workJournalIssns({ primary_location: { source: { issn: ['1234-5678'], issn_l: null } } })),
    ).toBe(true);
    expect(
      isIndexed(workJournalIssns({ primary_location: { source: { issn: [], issn_l: '9999-9999' } } })),
    ).toBe(false);
    expect(workJournalIssns({})).toEqual([]);
  });
});
