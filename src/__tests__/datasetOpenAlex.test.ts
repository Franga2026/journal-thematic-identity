import { describe, it, expect } from 'vitest';
import {
  mapOpenAlexDatasetToRecord,
  resolveDatasetIsOa,
  resolveDatasetAccessUrl,
} from '../utils/datasetOpenAlex';

describe('datasetOpenAlex', () => {
  it('is_oa true when open_access.is_oa is true', () => {
    expect(resolveDatasetIsOa({ open_access: { is_oa: true } })).toBe(true);
  });

  it('is_oa true when primary_location.is_oa is true', () => {
    expect(resolveDatasetIsOa({ primary_location: { is_oa: true } })).toBe(true);
  });

  it('is_oa false when both absent or false', () => {
    expect(resolveDatasetIsOa({})).toBe(false);
    expect(resolveDatasetIsOa({ open_access: { is_oa: false }, primary_location: { is_oa: false } })).toBe(
      false,
    );
  });

  it('prefers landing_page_url for access_url, falls back to doi', () => {
    expect(
      resolveDatasetAccessUrl({
        primary_location: { landing_page_url: 'https://zenodo.org/record/1' },
        doi: 'https://doi.org/10.5281/zenodo.1',
      }),
    ).toBe('https://zenodo.org/record/1');
    expect(resolveDatasetAccessUrl({ doi: '10.5281/zenodo.1' })).toBe(
      'https://doi.org/10.5281/zenodo.1',
    );
  });

  it('maps clean fields and legacy aliases', () => {
    const rec = mapOpenAlexDatasetToRecord({
      id: 'https://openalex.org/W123',
      doi: 'https://doi.org/10.5281/zenodo.9',
      display_name: 'Sample data',
      publication_year: 2024,
      cited_by_count: 3,
      open_access: { is_oa: true },
      primary_location: {
        is_oa: false,
        landing_page_url: 'https://zenodo.org/record/9',
        source: { display_name: 'Zenodo' },
        license: 'cc-by',
      },
      authorships: [{ author: { display_name: 'A. Author' } }],
    });
    expect(rec).toMatchObject({
      openalex_id: 'W123',
      repo: 'Zenodo',
      is_oa: true,
      access_url: 'https://zenodo.org/record/9',
      citas: 3,
      year: 2024,
      repository: 'Zenodo',
      landing_page_url: 'https://zenodo.org/record/9',
      cited_by_count: 3,
    });
  });
});
