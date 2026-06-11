import { describe, it, expect } from 'vitest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  normIssn,
  loadQuartileMap,
  getQuartile,
  makeGetQuartile,
} from '../utils/quartileIndex';

describe('quartileIndex', () => {
  it('normIssn normaliza guiones y mayúsculas', () => {
    expect(normIssn('1234-5678')).toBe('12345678');
    expect(normIssn('  abcd-efgh  ')).toBe('ABCDEFGH');
    expect(normIssn('123')).toBe('');
    expect(normIssn(null)).toBe('');
  });

  it('loadQuartileMap y getQuartile eligen el mejor cuartil', () => {
    const path = join(tmpdir(), `sjr-test-${Date.now()}.json`);
    writeFileSync(
      path,
      JSON.stringify({
        '12345678': 'Q2',
        '87654321': 'Q1',
        '11111111': 'Q4',
      }),
      'utf8',
    );
    try {
      const map = loadQuartileMap(path);
      expect(getQuartile(map, ['1234-5678'])).toBe('Q2');
      expect(getQuartile(map, ['1234-5678', '8765-4321'])).toBe('Q1');
      expect(getQuartile(map, ['9999-9999'])).toBeNull();

      const fn = makeGetQuartile(map);
      expect(fn(['1111-1111'])).toBe('Q4');
    } finally {
      unlinkSync(path);
    }
  });
});
