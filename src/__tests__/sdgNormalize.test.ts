import { describe, it, expect } from 'vitest';
import { normalizeSdgNumParam, normalizeSdgParam, resolveSdgFromRoute } from '../utils/sdgNormalize';
import { isUTAInstitution } from '../utils/institutionMatch';
import { workMatchesSdg } from '../utils/odsResearchers';

describe('sdgNormalize', () => {
  it('normalizeSdgParam strips ODS/SDG prefix', () => {
    expect(normalizeSdgParam('ODS12')).toBe('12');
    expect(normalizeSdgParam('SDG 10')).toBe('10');
  });

  it('normalizeSdgNumParam accepts route variants', () => {
    expect(normalizeSdgNumParam('12')).toBe(12);
    expect(normalizeSdgNumParam('ODS12')).toBe(12);
    expect(normalizeSdgNumParam('SDG12')).toBe(12);
    expect(normalizeSdgNumParam('99')).toBeNull();
  });

  it('resolveSdgFromRoute returns english name', () => {
    const ctx = resolveSdgFromRoute('12');
    expect(ctx?.sdgName).toBe('Responsible consumption and production');
    expect(ctx?.sdgNum).toBe(12);
  });

  it('isUTAInstitution matches Ambato and Tarapacá', () => {
    expect(isUTAInstitution('Universidad Técnica de Ambato')).toBe(true);
    expect(isUTAInstitution('Universidad de Tarapacá')).toBe(true);
  });

  it('workMatchesSdg matches spanish label', () => {
    expect(
      workMatchesSdg(
        { sdgs: ['Producción responsable'] },
        'Responsible consumption and production',
        12
      )
    ).toBe(true);
  });
});
