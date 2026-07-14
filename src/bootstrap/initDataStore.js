/**
 * Punto único de carga e inicialización de datos.
 *
 * JSON grandes → fetch desde /data/ (public/), fuera del bundle.
 * JSON pequeños → import estático.
 *
 * main.tsx debe await bootstrapData() antes de renderizar.
 */
import { initData } from '../utils/dataProcessing';

import DATA from '../data.json';
import OD from '../orcid-data.json';
import AI from '../ai-data.json';
import METRICS from '../institutional-metrics.json';
import RES_METRICS from '../researcher-metrics.json';
import DATASETS from '../datasets.json';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

/**
 * Carga corpus ligero + citas + coautores + OpenAlex por fetch,
 * luego hidrata el store con initData.
 */
export async function bootstrapData() {
  const [AW, CITATIONS, COAUTHORS, OA] = await Promise.all([
    fetchJson('/data/works-lite.json'),
    fetchJson('/data/work-citations.json'),
    fetchJson('/data/coauthor-profiles.json'),
    fetchJson('/data/openalex.json'),
  ]);

  initData({
    DATA,
    OA,
    AW,
    OD,
    AI,
    COAUTHORS,
    METRICS,
    RES_METRICS,
    CITATIONS,
    DATASETS,
  });

  if (import.meta.env.DEV) {
    console.log(
      `[bootstrapData] ${DATA.length} investigadores, ${AW.length} publicaciones (lite), ${Object.keys(OA.authors || {}).length} perfiles OpenAlex`,
    );
  }
}
