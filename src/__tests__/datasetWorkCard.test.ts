import { describe, it, expect } from 'vitest';
import {
  datasetAccessUrl,
  datasetCitations,
  datasetRepoLabel,
} from '../utils/datasetWorkCard';
import type { DatasetRecord } from '../shared/types';

const base: DatasetRecord = {
  openalex_id: 'W1',
  doi: '10.5281/zenodo.1',
  title: 'T',
  year: 2024,
  authors: [],
  repo: 'Zenodo',
  is_oa: true,
  access_url: 'https://zenodo.org/record/1',
  citas: 5,
  license: null,
};

describe('datasetWorkCard helpers', () => {
  it('resolves access_url with legacy fallbacks', () => {
    expect(datasetAccessUrl(base)).toBe('https://zenodo.org/record/1');
    expect(datasetAccessUrl({ ...base, access_url: null, landing_page_url: 'https://x.test' })).toBe(
      'https://x.test',
    );
    expect(datasetAccessUrl({ ...base, access_url: null, landing_page_url: null })).toBe(
      'https://doi.org/10.5281/zenodo.1',
    );
  });

  it('reads repo and citations with legacy aliases', () => {
    expect(datasetRepoLabel({ ...base, repo: null, repository: 'Figshare' })).toBe('Figshare');
    expect(datasetCitations({ ...base, citas: undefined, cited_by_count: 3 })).toBe(3);
  });
});
