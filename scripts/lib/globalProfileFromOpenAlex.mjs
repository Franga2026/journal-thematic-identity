/**
 * Contrato GlobalProfile (src/shared/types/globalProfile.ts) desde OpenAlex.
 * Usado por enrich-coauthor-global.mjs y build-ods-rankings.mjs.
 */

import './bootstrapProjectEnv.mjs';

export const OPENALEX_API_KEY = process.env.OPENALEX_API_KEY || '';

export function warnIfNoOpenAlexApiKey() {
  if (!OPENALEX_API_KEY) {
    console.warn(
      '⚠️ OPENALEX_API_KEY no configurada en .env.local — se usará el tramo sin key ($0.10/día, se bloqueará rápido). Configúrala para el presupuesto de $1/día.',
    );
  }
}

/** @param {URLSearchParams} params */
export function applyOpenAlexParams(params, { mailto = '', apiKey = process.env.OPENALEX_API_KEY || '' } = {}) {
  if (mailto) params.set('mailto', mailto);
  if (apiKey) params.set('api_key', apiKey);
  return params;
}

/** @param {string} url */
export function withOpenAlexParams(url, { mailto = '', apiKey = process.env.OPENALEX_API_KEY || '' } = {}) {
  const u = new URL(url);
  applyOpenAlexParams(u.searchParams, { mailto, apiKey });
  return u.toString();
}

export const WORK_SELECT = [
  'id',
  'title',
  'publication_year',
  'cited_by_count',
  'fwci',
  'citation_normalized_percentile',
  'open_access',
  'primary_location',
  'primary_topic',
  'authorships',
].join(',');

export const OA_META = {
  gold: { label: 'Oro', color: '#EAB308' },
  green: { label: 'Verde', color: '#15803D' },
  hybrid: { label: 'Híbrido', color: '#3B82F6' },
  bronze: { label: 'Bronce', color: '#B45309' },
  diamond: { label: 'Diamante', color: '#7C3AED' },
  closed: { label: 'Cerrado', color: '#9CA3AF' },
};

export const OA_ORDER = ['gold', 'green', 'hybrid', 'bronze', 'diamond', 'closed'];
export const OA_OPEN = new Set(['gold', 'green', 'hybrid', 'bronze', 'diamond']);

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function normIssn(s) {
  const v = (s ?? '').trim().toUpperCase().replace(/-/g, '');
  return v.length === 8 ? v : '';
}

/**
 * @param {string} authorId OpenAlex id corto (A…)
 * @param {(url: string) => Promise<unknown>} fetchFn
 * @param {{ baseUrl?: string, mailto?: string, select?: string, pageDelayMs?: number, sleep?: (ms: number) => Promise<void> }} [options]
 */
export async function fetchAllWorks(authorId, fetchFn, options = {}) {
  const {
    baseUrl = 'https://api.openalex.org',
    mailto = '',
    apiKey = process.env.OPENALEX_API_KEY || '',
    select = WORK_SELECT,
    pageDelayMs = 200,
    sleep = defaultSleep,
  } = options;

  const works = [];
  let cursor = '*';
  while (cursor) {
    const params = new URLSearchParams({
      filter: `author.id:${authorId}`,
      'per-page': '200',
      select,
      cursor,
    });
    applyOpenAlexParams(params, { mailto, apiKey });
    const url = `${baseUrl}/works?${params}`;
    const d = await fetchFn(url);
    const batch = d.results || [];
    works.push(...batch);
    cursor = d.meta?.next_cursor || null;
    if (!batch.length) break;
    if (cursor && pageDelayMs > 0) await sleep(pageDelayMs);
  }
  return works;
}

/**
 * @param {object} author Respuesta /authors/{id}
 * @param {object[]} works Todas las obras de carrera (shape WORK_SELECT)
 * @param {Record<string, string>|null} sjrMap ISSN → cuartil
 */
export function buildGlobalProfile(author, works, sjrMap) {
  const n = works.length || 1;
  const ss = author.summary_stats || {};
  const homeCountry =
    (author.last_known_institutions || []).map((i) => i.country_code).find(Boolean) || null;

  const fwcis = works.map((w) => w.fwci).filter((v) => v != null);
  const fwciMean = fwcis.length
    ? +(fwcis.reduce((a, b) => a + b, 0) / fwcis.length).toFixed(2)
    : null;

  let top10 = 0;
  let top1 = 0;
  for (const w of works) {
    const p = w.citation_normalized_percentile;
    if (p?.is_in_top_10_percent) top10++;
    if (p?.is_in_top_1_percent) top1++;
  }

  const oaCounts = {};
  for (const w of works) {
    const s = w.open_access?.oa_status || 'closed';
    oaCounts[s] = (oaCounts[s] || 0) + 1;
  }
  const oaSegments = OA_ORDER.filter((k) => oaCounts[k]).map((k) => ({
    key: k,
    ...OA_META[k],
    count: oaCounts[k],
    pct: Math.round((oaCounts[k] / n) * 100),
  }));
  const oaOpen = Object.entries(oaCounts)
    .filter(([k]) => OA_OPEN.has(k))
    .reduce((a, [, v]) => a + v, 0);
  const oaPct = Math.round((oaOpen / n) * 100);

  let intl = 0;
  let natl = 0;
  let inst = 0;
  for (const w of works) {
    const countries = new Set();
    const insts = new Set();
    for (const a of w.authorships || []) {
      for (const i of a.institutions || []) {
        if (i.country_code) countries.add(i.country_code);
        if (i.id) insts.add(i.id);
      }
    }
    if (countries.size >= 2) intl++;
    else if (insts.size >= 2) natl++;
    else inst++;
  }
  const scopeTotal = intl + natl + inst || 1;

  let cuartiles = null;
  if (sjrMap) {
    const q = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    let withQ = 0;
    for (const w of works) {
      const issn = normIssn(w.primary_location?.source?.issn_l);
      const qv = issn && sjrMap[issn];
      if (qv && q[qv] != null) {
        q[qv]++;
        withQ++;
      }
    }
    cuartiles = { ...q, with_quartile: withQ };
  }

  const cby = (author.counts_by_year || []).slice().sort((a, b) => a.year - b.year);
  let acc = 0;
  const trajectory = cby.map((c) => {
    acc += c.cited_by_count;
    return { year: c.year, works: c.works_count, cum_cits: acc };
  });

  const topWorks = works
    .slice()
    .sort((a, b) => (b.cited_by_count || 0) - (a.cited_by_count || 0))
    .slice(0, 5)
    .map((w) => ({
      title: w.title,
      year: w.publication_year,
      cited: w.cited_by_count,
      fwci: w.fwci,
      journal: w.primary_location?.source?.display_name || null,
      doi: w.id,
      oa_status: w.open_access?.oa_status || null,
    }));

  return {
    source: 'openalex',
    fetched_at: new Date().toISOString(),
    author_id: author.id,
    home_country: homeCountry,
    works_count: author.works_count,
    cited_by_count: author.cited_by_count,
    h_index: ss.h_index ?? null,
    i10_index: ss.i10_index ?? null,
    fwci_mean: fwciMean,
    elite: {
      total: works.length,
      top10,
      top1,
      pct10: Math.round((top10 / n) * 100),
      pct1: Math.round((top1 / n) * 100),
    },
    oa: { pct: oaPct, segments: oaSegments },
    scope: {
      intl: Math.round((intl / scopeTotal) * 100),
      natl: Math.round((natl / scopeTotal) * 100),
      inst: Math.round((inst / scopeTotal) * 100),
      total: scopeTotal,
    },
    cuartiles,
    trajectory,
    top_works: topWorks,
  };
}
