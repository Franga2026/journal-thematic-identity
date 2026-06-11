import type { DatasetRecord } from '../shared/types';

export function datasetAccessUrl(ds: DatasetRecord): string | null {
  const url = ds.access_url?.trim() || ds.landing_page_url?.trim();
  if (url) return url;
  const doi = ds.doi?.trim();
  if (!doi) return null;
  if (/^https?:\/\//i.test(doi)) return doi;
  const bare = doi.replace(/^https?:\/\/doi\.org\//i, '');
  return `https://doi.org/${bare}`;
}

export function datasetRepoLabel(ds: DatasetRecord): string | null {
  const repo = ds.repo?.trim() || ds.repository?.trim();
  return repo || null;
}

export function datasetCitations(ds: DatasetRecord): number {
  if (typeof ds.citas === 'number') return ds.citas;
  if (typeof ds.cited_by_count === 'number') return ds.cited_by_count;
  return 0;
}
