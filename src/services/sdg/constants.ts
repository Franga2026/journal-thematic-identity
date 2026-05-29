/** Pesos del score compuesto (deben sumar 1.0) */
export const SDG_SCORE_WEIGHTS = {
  publications: 0.35,
  citations: 0.35,
  hIndex: 0.2,
  collaboration: 0.1,
} as const;

export const OPENALEX_MAILTO = 'directorio.uta@tarapaca.cl';
export const OPENALEX_BASE = 'https://api.openalex.org';

/** Páginas máximas de obras por ODS (200 obras/página → hasta 3000) */
export const SDG_WORKS_MAX_PAGES = 15;
export const SDG_WORKS_PER_PAGE = 200;

/** TTL caché en memoria (ms) */
export const SDG_RANKING_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Iberoamérica: Latinoamérica hispanohablante + España, Portugal y Brasil.
 * Códigos ISO usados por OpenAlex en institutions.country_code.
 */
export const IBEROAMERICA_COUNTRY_SET = new Set([
  'AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'ES', 'GT', 'HN',
  'MX', 'NI', 'PA', 'PE', 'PR', 'PY', 'PT', 'SV', 'UY', 'VE',
]);

export { isUTAInstitution, isUtaInstitution } from '../../utils/institutionMatch';
