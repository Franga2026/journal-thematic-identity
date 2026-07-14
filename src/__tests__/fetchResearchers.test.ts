import { describe, it, expect } from 'vitest';
import { resolveSdgParam } from '../services/catalog/fetchResearchers';

describe('resolveSdgParam', () => {
  it('mapea nombre EN → número', () => {
    expect(resolveSdgParam('Good health and well-being')).toBe(3);
    expect(resolveSdgParam('Life on land')).toBe(15);
  });

  it('acepta número como string', () => {
    expect(resolveSdgParam('3')).toBe(3);
  });

  it('rechaza vacío o inválido', () => {
    expect(resolveSdgParam('')).toBeNull();
    expect(resolveSdgParam('nope')).toBeNull();
  });
});
