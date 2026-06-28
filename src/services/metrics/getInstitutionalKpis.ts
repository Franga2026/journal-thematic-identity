import { getAW, getInstitution, getMetrics } from '../../utils/dataProcessing';

export interface OaBreakdown {
  gold: number;
  green: number;
  hybrid: number;
  bronze: number;
  closed: number;
}

export interface ProductionYearPoint {
  year: number;
  count: number;
}

export interface InstitutionalKpis {
  publications: number;
  citations: number;
  oaRate: number;
  oaBreakdown: OaBreakdown;
  hIndex: number;
  fwci: number;
  productionByYear: ProductionYearPoint[];
}

const RECENT_YEAR_FLOOR = 2019;

function oaBucketCount(
  openAccess: Record<string, { count?: number; pct?: number }> | undefined,
  key: keyof OaBreakdown,
): number {
  const entry = openAccess?.[key];
  return typeof entry?.count === 'number' ? entry.count : 0;
}

function emptyOaBreakdown(): OaBreakdown {
  return { gold: 0, green: 0, hybrid: 0, bronze: 0, closed: 0 };
}

/**
 * KPIs institucionales canónicos para el home/dashboard.
 * IMPLEMENTACIÓN ACTUAL: institutional-metrics.json + institution (OpenAlex).
 * FUTURO SaaS: misma firma; el backend del tenant provee metrics equivalentes.
 */
export function getInstitutionalKpis(): InstitutionalKpis {
  const metrics = getMetrics() || {};
  const institution = getInstitution() || {};

  // scholarly_output; fallback: longitud de all-works si el tenant no publica el agregado
  const publications =
    typeof metrics.scholarly_output === 'number'
      ? metrics.scholarly_output
      : (getAW() || []).length;

  // citation_count; sin fallback a sumar obras (fuente distinta)
  const citations = typeof metrics.citation_count === 'number' ? metrics.citation_count : 0;

  const openAccess = metrics.open_access as
    | (Record<string, { count?: number; pct?: number }> & { oa_rate?: number })
    | undefined;

  const oaRate = typeof openAccess?.oa_rate === 'number' ? openAccess.oa_rate : 0;

  const oaBreakdown: OaBreakdown = openAccess
    ? {
        gold: oaBucketCount(openAccess, 'gold'),
        green: oaBucketCount(openAccess, 'green'),
        hybrid: oaBucketCount(openAccess, 'hybrid'),
        bronze: oaBucketCount(openAccess, 'bronze'),
        closed: oaBucketCount(openAccess, 'closed'),
      }
    : emptyOaBreakdown();

  // h_index institucional; fallback: openalex.institution.h_index
  const hIndex =
    typeof metrics.h_index === 'number'
      ? metrics.h_index
      : typeof institution.h_index === 'number'
        ? institution.h_index
        : 0;

  const fwci = typeof metrics.fwci === 'number' ? metrics.fwci : 0;

  const productionByYear = buildRecentProductionByYear(metrics, institution);

  return {
    publications,
    citations,
    oaRate,
    oaBreakdown,
    hIndex,
    fwci,
    productionByYear,
  };
}

function buildRecentProductionByYear(
  metrics: { trends?: Array<{ year?: number; output?: number }> },
  institution: { counts_by_year?: Array<{ year?: number; works_count?: number }> },
): ProductionYearPoint[] {
  if (Array.isArray(metrics.trends) && metrics.trends.length > 0) {
    return metrics.trends
      .filter((row) => typeof row.year === 'number' && row.year >= RECENT_YEAR_FLOOR)
      .map((row) => ({
        year: row.year as number,
        count: typeof row.output === 'number' ? row.output : 0,
      }))
      .sort((a, b) => a.year - b.year);
  }

  // Fallback: openalex.institution.counts_by_year (works_count por año)
  const countsByYear = institution.counts_by_year;
  if (Array.isArray(countsByYear) && countsByYear.length > 0) {
    return countsByYear
      .filter((row) => typeof row.year === 'number' && row.year >= RECENT_YEAR_FLOOR)
      .map((row) => ({
        year: row.year as number,
        count: typeof row.works_count === 'number' ? row.works_count : 0,
      }))
      .sort((a, b) => a.year - b.year);
  }

  return [];
}
