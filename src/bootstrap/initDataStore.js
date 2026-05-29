/**
 * Punto único de carga e inicialización de datos.
 * Se importa una sola vez desde main.tsx antes del render.
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
import WORK_CITATIONS from '../data/work-citations.json';

initData({ DATA, OA, AW, OD, AI, COAUTHORS, METRICS, RES_METRICS, CITATIONS: WORK_CITATIONS });

if (import.meta.env.DEV) {
  console.log(
    `[initDataStore] ${DATA.length} investigadores, ${AW.length} publicaciones, ${Object.keys(OA.authors || {}).length} perfiles OpenAlex`
  );
}
