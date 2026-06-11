import { join } from 'node:path';
import type { Researcher, Work } from '../../shared/types';
import { getData, getOA } from '../../utils/dataProcessing';
import { getEnrichedWorksForResearcher } from '../../utils/researcherWorks';
import { cleanOrcid, stripTags } from '../../utils/helpers';
import { fwciIsEligible } from '../../shared/metrics/fwci';
import { getWorkOpenAlexCitations, getWorkOpenAlexFwci } from '../../utils/workMetrics';
import { groupWorksByArea } from '../../utils/areaGrouping';
import { loadQuartileMap, getQuartile, type Quartile } from '../../utils/quartileIndex';
import { workIssnCandidates } from '../../utils/localQuartileProfile';
import { ensureServerData } from '../../server/ensureServerData';

const SJR_MAP_PATH = join(process.cwd(), 'scripts/data/sjr-2025-quartiles.json');
const WINDOW_YEARS = 5;
const MIN_PUBS_DENSITY = 5;

export class ReportMetricsError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ReportMetricsError';
    this.statusCode = statusCode;
  }
}

export interface ReportObraRow {
  titulo: string;
  doi: string;
  doi_url: string;
  anio: number | string;
  revista: string;
  cuartil: string;
  citas: number;
  fwci: string;
}

export interface ReportMetricsResult {
  nombre_investigador: string;
  apellido: string;
  unidad: string;
  orcid: string;
  periodo_inicio: number;
  periodo_fin: number;
  fecha_snapshot: string;
  n_pubs: number;
  fwci_global: number | null;
  fwci_pct: number | null;
  fwci_pct_label: string;
  cpp: number | null;
  h_index: number;
  pct_q1: number | null;
  cagr: number | null;
  cagr_label: string;
  area_top: string;
  pct_area_top: number;
  area_2: string;
  pct_area_2: number;
  pct_top10: string;
  pct_colab_intl: string;
  prod_por_anio: Array<{ anio: number; count: number }>;
  prod_por_area: Array<{ area: string; count: number; pct: number }>;
  dist_cuartiles: { Q1: number; Q2: number; Q3: number; Q4: number };
  obras: ReportObraRow[];
}

let quartileMapCache: Map<string, Quartile> | null = null;

function getQuartileMap(): Map<string, Quartile> {
  if (!quartileMapCache) {
    quartileMapCache = loadQuartileMap(SJR_MAP_PATH);
  }
  return quartileMapCache;
}

export function isValidOrcidFormat(raw: string): boolean {
  const c = cleanOrcid(raw);
  return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(c);
}

export function getSnapshotYear(): number {
  const fetched = getOA()?.fetched_at;
  if (fetched) {
    const y = new Date(fetched).getFullYear();
    if (!Number.isNaN(y)) return y;
  }
  return new Date().getFullYear();
}

export function workYear(w: Work): number | null {
  const y = w.y ?? (w as { year?: number }).year;
  if (y == null || y === '') return null;
  const n = Number(y);
  return Number.isFinite(n) ? n : null;
}

export function isDatasetWork(w: Work): boolean {
  const tp = (w.tp || '').toLowerCase();
  return tp === 'dataset' || tp.includes('dataset');
}

export function nPubs(works: Work[]): number {
  return works.filter((w) => !isDatasetWork(w)).length;
}

export function computeHIndex(works: Work[]): number {
  const cites = works
    .filter((w) => !isDatasetWork(w))
    .map((w) => getWorkOpenAlexCitations(w))
    .sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < cites.length; i++) {
    if (cites[i] >= i + 1) h = i + 1;
    else break;
  }
  return h;
}

export function resolveWorkQuartile(w: Work, map: Map<string, Quartile>): Quartile | null {
  const qi = (w.qi || '').trim().toUpperCase();
  if (/^Q[1-4]$/.test(qi)) return qi as Quartile;
  return getQuartile(map, workIssnCandidates(w));
}

export function computeAdaptivePeriod(
  works: Work[],
  snapshotYear: number,
): { inicio: number; fin: number; periodWorks: Work[] } {
  const years = works.map(workYear).filter((y): y is number => y != null);
  if (!years.length) {
    throw new ReportMetricsError('Sin producción indexada en OpenAlex', 422);
  }

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  let fin = Math.min(snapshotYear, maxYear);
  let inicio = Math.max(fin - (WINDOW_YEARS - 1), minYear);

  const filterPeriod = (start: number, end: number) =>
    works.filter((w) => {
      const y = workYear(w);
      return y != null && y >= start && y <= end;
    });

  let periodWorks = filterPeriod(inicio, fin);
  while (nPubs(periodWorks) < MIN_PUBS_DENSITY && inicio > minYear) {
    inicio -= 1;
    periodWorks = filterPeriod(inicio, fin);
  }

  return { inicio, fin, periodWorks };
}

export function computeCagr(
  prodPorAnio: Array<{ anio: number; count: number }>,
  inicio: number,
  fin: number,
): number | null {
  const byYear = new Map(prodPorAnio.map((p) => [p.anio, p.count]));
  let startYear: number | null = null;
  let startVal = 0;
  for (let y = inicio; y <= fin; y++) {
    const c = byYear.get(y) ?? 0;
    if (c >= 1) {
      startYear = y;
      startVal = c;
      break;
    }
  }
  if (startYear == null) return null;
  const endVal = byYear.get(fin) ?? 0;
  const span = fin - startYear;
  if (span <= 0 || startVal <= 0) return null;
  const rate = (Math.pow(endVal / startVal, 1 / span) - 1) * 100;
  return +rate.toFixed(1);
}

function formatFwciPct(fwci: number | null): { fwci_pct: number | null; fwci_pct_label: string } {
  if (fwci == null) return { fwci_pct: null, fwci_pct_label: '—' };
  const pct = Math.round((fwci - 1) * 100);
  const label =
    pct > 0
      ? `${pct}% sobre el promedio mundial`
      : pct < 0
        ? `${Math.abs(pct)}% bajo el promedio mundial`
        : 'en el promedio mundial';
  return { fwci_pct: pct, fwci_pct_label: label };
}

function normalizeDoi(doi?: string): string {
  const raw = (doi || '').trim();
  if (!raw) return '';
  return raw.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
}

export function buildReportMetricsFromWorks(
  researcher: Researcher,
  works: Work[],
  snapshotYear: number,
  quartileMap?: Map<string, Quartile>,
): ReportMetricsResult {
  const map = quartileMap ?? getQuartileMap();
  const { inicio, fin, periodWorks } = computeAdaptivePeriod(works, snapshotYear);
  const pubs = periodWorks.filter((w) => !isDatasetWork(w));
  const n = nPubs(periodWorks);

  const fwciValues: number[] = [];
  for (const w of periodWorks) {
    if (!fwciIsEligible(w)) continue;
    const v = getWorkOpenAlexFwci(w);
    if (v != null) fwciValues.push(v);
  }
  const fwci_global =
    fwciValues.length > 0
      ? +(fwciValues.reduce((s, x) => s + x, 0) / fwciValues.length).toFixed(2)
      : null;
  const { fwci_pct, fwci_pct_label } = formatFwciPct(fwci_global);

  const totalCites = pubs.reduce((s, w) => s + getWorkOpenAlexCitations(w), 0);
  const cpp = n > 0 ? +(totalCites / n).toFixed(2) : null;
  const h_index = computeHIndex(periodWorks);

  const dist_cuartiles = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
  for (const w of pubs) {
    const q = resolveWorkQuartile(w, map);
    if (q) dist_cuartiles[q]++;
  }
  const withQuartile = dist_cuartiles.Q1 + dist_cuartiles.Q2 + dist_cuartiles.Q3 + dist_cuartiles.Q4;
  const pct_q1 =
    withQuartile > 0 ? +((dist_cuartiles.Q1 / withQuartile) * 100).toFixed(1) : null;

  const prod_por_anio: Array<{ anio: number; count: number }> = [];
  for (let y = inicio; y <= fin; y++) {
    const count = periodWorks.filter((w) => workYear(w) === y && !isDatasetWork(w)).length;
    prod_por_anio.push({ anio: y, count });
  }

  const cagr = computeCagr(prod_por_anio, inicio, fin);
  const cagr_label = cagr != null ? `${cagr > 0 ? '+' : ''}${cagr}% anual` : '—';

  const areas = groupWorksByArea(pubs);
  const area_top = areas[0]?.name ?? '—';
  const pct_area_top = areas[0]?.sharePct ?? 0;
  const area_2 = areas[1]?.name ?? '—';
  const pct_area_2 = areas[1]?.sharePct ?? 0;

  const prod_por_area = areas.slice(0, 8).map((a) => ({
    area: a.name,
    count: a.count,
    pct: a.sharePct,
  }));

  const oaFetched = getOA()?.fetched_at;
  const fecha_snapshot = oaFetched
    ? new Date(oaFetched).toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('es-CL');

  const obras: ReportObraRow[] = [...pubs]
    .sort((a, b) => getWorkOpenAlexCitations(b) - getWorkOpenAlexCitations(a))
    .slice(0, 10)
    .map((w) => {
      const doi = normalizeDoi(w.d ?? w.doi);
      const fwciVal = getWorkOpenAlexFwci(w);
      const q = resolveWorkQuartile(w, map);
      return {
        titulo: stripTags(w.t || w.title || 'Sin título'),
        doi,
        doi_url: doi ? `https://doi.org/${doi}` : '',
        anio: workYear(w) ?? '—',
        revista: (w.s || w.pub || '—').trim() || '—',
        cuartil: q ?? '—',
        citas: getWorkOpenAlexCitations(w),
        fwci: fwciVal != null ? fwciVal.toFixed(2) : '—',
      };
    });

  return {
    nombre_investigador: `${researcher.f || ''} ${researcher.l || ''}`.trim(),
    apellido: (researcher.l || 'investigador').trim(),
    unidad: (researcher.dp || [])[0]?.d?.trim() || 'Universidad de Tarapacá',
    orcid: cleanOrcid(researcher.o),
    periodo_inicio: inicio,
    periodo_fin: fin,
    fecha_snapshot,
    n_pubs: n,
    fwci_global,
    fwci_pct,
    fwci_pct_label,
    cpp,
    h_index,
    pct_q1,
    cagr,
    cagr_label,
    area_top,
    pct_area_top,
    area_2,
    pct_area_2,
    pct_top10: '—',
    pct_colab_intl: '—',
    prod_por_anio,
    prod_por_area,
    dist_cuartiles,
    obras,
  };
}

export function findResearcherByOrcid(orcid: string): Researcher | null {
  const key = cleanOrcid(orcid);
  if (!key) return null;
  return getData().find((r) => cleanOrcid(r.o) === key) ?? null;
}

/** Métricas del informe CRIS Victoria para un ORCID UTA. */
export function reportMetrics(orcid: string): ReportMetricsResult {
  ensureServerData();
  if (!isValidOrcidFormat(orcid)) {
    throw new ReportMetricsError('ORCID inválido', 400);
  }
  const researcher = findResearcherByOrcid(orcid);
  if (!researcher) {
    throw new ReportMetricsError('Investigador no encontrado en el directorio UTA', 404);
  }
  const works = getEnrichedWorksForResearcher(researcher);
  if (!works.length) {
    throw new ReportMetricsError('Sin producción indexada en OpenAlex', 422);
  }
  return buildReportMetricsFromWorks(researcher, works, getSnapshotYear());
}
