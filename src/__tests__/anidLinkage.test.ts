import { describe, expect, it } from 'vitest';
import { getAnidLinkageForResearcher, getAnidProfileUrl } from '../utils/anidLinkage';
import type { Researcher } from '../../shared/types';

describe('anidLinkage', () => {
  it('resuelve por ORCID', () => {
    const person: Researcher = {
      f: 'Gloria',
      l: 'Calaf Sarrat',
      o: '0000-0003-3542-296X',
      id: '04105653-3',
    };
    const hit = getAnidLinkageForResearcher(person);
    expect(hit?.anid_id).toBe('26544');
  });

  it('resuelve por RUT si falta ORCID', () => {
    const person: Researcher = {
      f: 'Gloria',
      l: 'Calaf Sarrat',
      id: '04105653-3',
    };
    const hit = getAnidLinkageForResearcher(person);
    expect(hit?.anid_id).toBe('26544');
  });

  it('retorna null si no hay enlace', () => {
    const person: Researcher = { f: 'Sin', l: 'Anid', id: '99999999-9' };
    expect(getAnidLinkageForResearcher(person)).toBeNull();
  });

  it('construye URL del perfil ANID', () => {
    expect(getAnidProfileUrl('26544')).toBe(
      'https://investigadores.anid.cl/es/public_search/researcher?id=26544',
    );
  });
});
