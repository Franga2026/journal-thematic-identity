/**
 * bootstrapData.js
 * 
 * Punto único de carga e inicialización de datos.
 * Se importa una sola vez desde main.jsx antes del render.
 * Todos los JSON se cargan aquí y se inyectan al dataProcessing store.
 */
import { initData } from '../utils/dataProcessing';

import DATA from '../data.json';
import OA from '../openalex.json';
import AW from '../all-works.json';
import OD from '../orcid-data.json';
import AI from '../ai-data.json';
import COAUTHORS from '../coauthor-profiles.json';
import METRICS from '../institutional-metrics.json';
import RES_METRICS from '../researcher-metrics.json';

initData({ DATA, OA, AW, OD, AI, COAUTHORS, METRICS, RES_METRICS });

if (import.meta.env.DEV) {
  console.log(
    `[bootstrapData] Loaded: ${DATA.length} researchers, ${AW.length} works, ${Object.keys(OA.authors || {}).length} OA profiles`
  );
}
