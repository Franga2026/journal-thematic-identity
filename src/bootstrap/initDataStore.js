/**
 * Punto único de carga e inicialización de datos.
 *
 * JSON grandes → fetch desde /data/ (public/), fuera del bundle.
 * JSON pequeños → import estático.
 * Unidades → GET /units del proxy cris-discovery-api (Postgres); soft-fail.
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

const API_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DISCOVERY_API_URL) ||
  'http://localhost:8002';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

/**
 * GET /units — soft-fail: la app arranca; getters caen a JSON si viene [].
 */
function fetchUnitsSoft() {
  return fetch(`${API_URL}/units`)
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .catch((err) => {
      console.error('[bootstrapData] No se pudo cargar /units:', err);
      return [];
    });
}

/**
 * Carga corpus ligero + citas + coautores + OpenAlex + unidades (API),
 * luego hidrata el store con initData.
 */
export async function bootstrapData() {
  const [AW, CITATIONS, COAUTHORS, OA, UNITS] = await Promise.all([
    fetchJson('/data/works-lite.json'),
    fetchJson('/data/work-citations.json'),
    fetchJson('/data/coauthor-profiles.json'),
    fetchJson('/data/openalex.json'),
    fetchUnitsSoft(),
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
    UNITS,
  });

  if (import.meta.env.DEV) {
    const nUnits = Array.isArray(UNITS?.results)
      ? UNITS.results.length
      : Array.isArray(UNITS)
        ? UNITS.length
        : 0;
    console.log(
      `[bootstrapData] ${DATA.length} investigadores, ${AW.length} publicaciones (lite), ${Object.keys(OA.authors || {}).length} perfiles OpenAlex` +
        (nUnits ? `, ${nUnits} unidades (API)` : ', unidades: fallback JSON'),
    );
  }
}
