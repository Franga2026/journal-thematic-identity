import { describe, it, expect } from 'vitest';
import { numEs, parseReportInt } from './numEs';

describe('numEs', () => {
  it('escribe 1–10 en palabras', () => {
    expect(numEs(1)).toBe('una');
    expect(numEs(10)).toBe('diez');
  });

  it('deja el dígito para n > 10', () => {
    expect(numEs(11)).toBe('11');
    expect(numEs(121)).toBe('121');
  });
});

describe('parseReportInt', () => {
  it('parsea strings enteros del informe', () => {
    expect(parseReportInt('87')).toBe(87);
    expect(parseReportInt(10)).toBe(10);
  });
});
