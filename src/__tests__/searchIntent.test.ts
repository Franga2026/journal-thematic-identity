import { describe, it, expect } from 'vitest';
import { detectSearchIntent, getSearchIntentMeta } from '../utils/searchIntent';

describe('searchIntent', () => {
  it('detects ORCID', () => {
    expect(detectSearchIntent('0000-0002-3523-1197')).toBe('orcid');
  });

  it('detects DOI', () => {
    expect(detectSearchIntent('10.1016/j.example')).toBe('doi');
  });

  it('detects ISSN', () => {
    expect(detectSearchIntent('2071-1050')).toBe('issn');
  });

  it('defaults to general text', () => {
    expect(detectSearchIntent('machine learning')).toBe('general');
  });

  it('routes ORCID to perfiles', () => {
    expect(getSearchIntentMeta('0000-0001-2345-6789').route).toBe('/perfiles');
  });

  it('routes DOI to descubridor', () => {
    expect(getSearchIntentMeta('10.1038/nature12373').route).toBe('/descubridor');
  });
});
