import { describe, it, expect } from 'vitest';
import { hash, getColor, getInitials, shortDept, stripTags, cleanOrcid, pct, clamp } from '../utils/helpers';
import { COLORS } from '../utils/constants';

describe('helpers', () => {
  describe('hash', () => {
    it('returns a positive number', () => {
      expect(hash('test')).toBeGreaterThanOrEqual(0);
    });

    it('is deterministic', () => {
      expect(hash('abc')).toBe(hash('abc'));
    });

    it('handles empty/null input', () => {
      expect(hash('')).toBe(0);
      expect(hash(null)).toBe(0);
      expect(hash(undefined)).toBe(0);
    });
  });

  describe('getColor', () => {
    it('returns a color from COLORS array', () => {
      const color = getColor('test');
      expect(COLORS).toContain(color);
    });

    it('is deterministic', () => {
      expect(getColor('Juan Pérez')).toBe(getColor('Juan Pérez'));
    });
  });

  describe('getInitials', () => {
    it('returns two-letter initials', () => {
      expect(getInitials('Juan', 'Pérez')).toBe('JP');
    });

    it('handles empty names', () => {
      expect(getInitials('', '')).toBe('?');
      expect(getInitials(null, null)).toBe('?');
    });

    it('handles single name', () => {
      expect(getInitials('Juan', '')).toBe('J');
    });
  });

  describe('shortDept', () => {
    it('removes "Departamento de" prefix', () => {
      expect(shortDept('Departamento de Física')).toBe('Física');
    });

    it('removes "Escuela de" prefix', () => {
      expect(shortDept('Escuela de Ingeniería')).toBe('Ingeniería');
    });

    it('handles null', () => {
      expect(shortDept(null)).toBe('');
    });
  });

  describe('stripTags', () => {
    it('removes HTML tags', () => {
      expect(stripTags('<b>Hello</b> <i>world</i>')).toBe('Hello world');
    });

    it('collapses whitespace', () => {
      expect(stripTags('  Hello   world  ')).toBe('Hello world');
    });

    it('handles null', () => {
      expect(stripTags(null)).toBe('');
    });
  });

  describe('cleanOrcid', () => {
    it('strips URL prefix', () => {
      expect(cleanOrcid('https://orcid.org/0000-0001-2345-6789')).toBe('0000-0001-2345-6789');
    });

    it('handles bare ORCID', () => {
      expect(cleanOrcid('0000-0001-2345-6789')).toBe('0000-0001-2345-6789');
    });

    it('handles http variant', () => {
      expect(cleanOrcid('http://orcid.org/0000-0001-2345-6789')).toBe('0000-0001-2345-6789');
    });

    it('handles null', () => {
      expect(cleanOrcid(null)).toBe('');
    });
  });

  describe('pct', () => {
    it('calculates percentage', () => {
      expect(pct(25, 100)).toBe(25);
      expect(pct(1, 3)).toBe(33);
    });

    it('handles zero total', () => {
      expect(pct(5, 0)).toBe(0);
    });
  });

  describe('clamp', () => {
    it('clamps within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });
});
