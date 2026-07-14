import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearWorksCache,
  getWorksCount,
  loadAuthorWorks,
  setAuthorWorksForTests,
  setWorksIndexForTests,
} from '../services/authorWorksLoader';
import type { Work } from '../shared/types';

describe('authorWorksLoader', () => {
  beforeEach(() => {
    clearWorksCache();
  });

  it('getWorksCount usa el índice inyectado', async () => {
    setWorksIndexForTests({ '03339399-7': 12, '07177740-5': 40 });
    expect(await getWorksCount('03339399-7')).toBe(12);
    expect(await getWorksCount('00000000-0')).toBe(0);
  });

  it('loadAuthorWorks sirve desde caché de tests', async () => {
    const sample = [{ t: 'Obra demo', y: 2020 }] as Work[];
    setAuthorWorksForTests('07177740-5', sample);
    const a = await loadAuthorWorks('07177740-5');
    const b = await loadAuthorWorks('07177740-5');
    expect(a).toEqual(sample);
    expect(b).toBe(a); // misma referencia = caché
  });

  it('loadAuthorWorks con id vacío → []', async () => {
    expect(await loadAuthorWorks('')).toEqual([]);
    expect(await loadAuthorWorks('  ')).toEqual([]);
  });
});
