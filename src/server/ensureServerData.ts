import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { initData } from '../utils/dataProcessing.js';

let loaded = false;

export function ensureServerData(): void {
  if (loaded) return;
  const src = join(process.cwd(), 'src');
  const readJson = (name: string, fallback: unknown = []) => {
    const path = join(src, name);
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf8'));
  };

  initData({
    DATA: readJson('data.json', []),
    OA: readJson('openalex.json', {}),
    AW: readJson('all-works.json', []),
    OD: readJson('orcid-data.json', {}),
    AI: readJson('ai-data.json', {}),
    COAUTHORS: readJson('coauthor-profiles.json', {}),
    METRICS: readJson('institutional-metrics.json', {}),
    RES_METRICS: readJson('researcher-metrics.json', {}),
    CITATIONS: {},
    DATASETS: readJson('datasets.json', {}),
  });
  loaded = true;
}

export function resetServerDataForTests(): void {
  loaded = false;
}
