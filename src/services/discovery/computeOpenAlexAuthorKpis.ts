/**
 * computeOpenAlexAuthorKpis.ts — Calcula los 7 KPIs de la ficha rica
 * EN VIVO desde OpenAlex, para investigadores externos (no UTA) en el
 * descubridor universal.
 *
 * Replica los KPIs de ResearcherModal.buildMetricDefs() pero sin depender
 * de openalex.json: 4 salen directos del objeto autor, y 3 (FWCI, OA%,
 * datasets) se agregan en UNA sola pasada sobre sus obras — la misma
 * pasada que ya hace fetchAuthorFwci, así no añadimos llamadas.
 *
 * Principio de honestidad: NO incluye percentiles UTA (no se pueden
 * calcular para autores externos). Solo lo que OpenAlex sí provee.
 */

export interface AuthorWorkLite {
  fwci?: number | null;
  is_oa?: boolean | null;
  type?: string | null;
}

export interface OpenAlexAuthorKpis {
  hIndex: number | null;
  worksCount: number | null;
  citedByCount: number | null;
  cpp: number | null;
  fwciMean: number | null;
  fwciN: number;
  oaRate: number | null;
  datasetsCount: number;
  worksSampled: number;
  distinctions: string[];
}

interface AuthorSummary {
  h_index?: number | null;
  works_count?: number | null;
  cited_by_count?: number | null;
  summary_stats?: { h_index?: number | null; '2yr_mean_citedness'?: number | null } | null;
}

export function computeAuthorKpis(
  author: AuthorSummary,
  works: AuthorWorkLite[],
): OpenAlexAuthorKpis {
  const worksCount = author.works_count ?? null;
  const citedByCount = author.cited_by_count ?? null;
  const hIndex = author.h_index ?? author.summary_stats?.h_index ?? null;
  const cpp =
    worksCount && citedByCount && worksCount > 0
      ? Math.round((citedByCount / worksCount) * 10) / 10
      : null;

  let fwciSum = 0;
  let fwciN = 0;
  let oaCount = 0;
  let datasetsCount = 0;
  const sampled = works.length;

  for (const w of works) {
    if (typeof w.fwci === 'number' && !Number.isNaN(w.fwci)) {
      fwciSum += w.fwci;
      fwciN += 1;
    }
    if (w.is_oa === true) oaCount += 1;
    if (w.type === 'dataset') datasetsCount += 1;
  }

  const fwciMean = fwciN > 0 ? Math.round((fwciSum / fwciN) * 100) / 100 : null;
  const oaRate = sampled > 0 ? oaCount / sampled : null;

  const distinctions: string[] = [];
  if (citedByCount != null && citedByCount > 5000) distinctions.push('Altamente citado');
  if (fwciMean != null && fwciMean > 1) distinctions.push('Sobre media mundial');
  if (worksCount != null && worksCount > 100) distinctions.push('Productivo');
  if (datasetsCount > 0) distinctions.push('Comparte datos');

  return {
    hIndex,
    worksCount,
    citedByCount,
    cpp,
    fwciMean,
    fwciN,
    oaRate,
    datasetsCount,
    worksSampled: sampled,
    distinctions,
  };
}

export function buildOpenAlexMetricTiles(k: OpenAlexAuthorKpis) {
  const fmt = (v: number | null) =>
    v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1).replace('.0', '')}K` : String(v);
  const dec = (v: number | null) => (v == null ? '—' : v.toFixed(2).replace('.', ','));
  const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);

  return [
    { key: 'h_index', label: 'h-index', value: fmt(k.hIndex), hint: null },
    {
      key: 'fwci',
      label: 'FWCI',
      value: dec(k.fwciMean),
      hint: k.fwciN > 0 ? `sobre ${k.fwciN} obras` : 'sin datos FWCI',
    },
    { key: 'cpp', label: 'Citas/Pub', value: dec(k.cpp), hint: null },
    { key: 'output', label: 'Producción', value: fmt(k.worksCount), hint: null },
    { key: 'cites', label: 'Citas totales', value: fmt(k.citedByCount), hint: null },
    {
      key: 'oa_rate',
      label: 'Acceso abierto',
      value: pct(k.oaRate),
      hint: k.worksSampled > 0 ? `de ${k.worksSampled} muestreadas` : null,
    },
    { key: 'datasets', label: 'Datasets', value: fmt(k.datasetsCount), hint: null },
  ];
}
