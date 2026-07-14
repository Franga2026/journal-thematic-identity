import { cleanOrcid, normalizeAuthorName, getResearcherUtaId } from './helpers.js';
import { setWorkCitationsIndex } from './citation/citationsStore.ts';
import { linkAutoresUta } from './linkAutoresUta.ts';

export { getResearcherUtaId } from './helpers.js';
export { linkAutoresUta } from './linkAutoresUta.ts';

// These will be initialized with actual data imports
let _DATA = [];
let _OA = {};
let _AW = [];
let _OD = {};
let _AI = {};
let _COAUTHORS = {};
/** @type {Map<string, import('../shared/types').CoAuthorProfile>} */
let _COAUTHORS_BY_OA = new Map();
let _METRICS = {};
let _RES_METRICS = {};
let _CITATIONS = {};
let _AW_BY_TITLE = {};
/** @type {Record<string, { fetchedAt?: string, records?: import('../shared/types').DatasetRecord[] }>} */
let _DATASETS = {};
/**
 * Filas crudas de GET /units (`{ id, name, total, with_orcid, pct }`).
 * Vacío → getters caen al cómputo desde _DATA (JSON / tests).
 * @type {Array<{ id?: number, name: string, total?: number, with_orcid?: number, pct?: number|null }>}
 */
let _UNITS = [];

function parseOpenAlexAuthorId(oaId) {
  if (!oaId) return '';
  return String(oaId).replace(/^https?:\/\/openalex\.org\//i, '').trim().toUpperCase();
}

function rebuildCoAuthorIndexes() {
  _COAUTHORS_BY_OA = new Map();
  Object.values(_COAUTHORS).forEach((profile) => {
    const oaKey = parseOpenAlexAuthorId(profile?.oaId);
    if (oaKey) _COAUTHORS_BY_OA.set(oaKey, profile);
  });
}

/**
 * Initialize all data sources. Call once at app startup.
 */
function computeDistributionStats(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const pct = (p) => {
    const i = (n - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return lo === hi ? s[lo] : s[lo] * (hi - i) + s[hi] * (i - lo);
  };
  const variance = s.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
  const round = (v, d = 2) => +v.toFixed(d);
  return {
    min: round(s[0], 3),
    max: round(s[n - 1], 3),
    mean: round(mean, 2),
    median: round(pct(0.5), 2),
    p25: round(pct(0.25), 3),
    p75: round(pct(0.75), 3),
    std: round(Math.sqrt(variance), 2),
  };
}

/** @type {Record<string, number[]>} */
let _DIST_RAW = {};

function empiricalPercentile(value, sortedValues) {
  if (value === null || value === undefined || Number.isNaN(value) || !sortedValues?.length) {
    return null;
  }
  const below = sortedValues.filter((v) => v < value).length;
  const equal = sortedValues.filter((v) => v === value).length;
  return Math.min(99, Math.max(0, Math.round(((below + equal * 0.5) / sortedValues.length) * 100)));
}

/** Percentil empírico institucional (rank sobre la cohorte real, no escala lineal min–max). */
export function getMetricPercentile(metricKey, value) {
  const raw = _DIST_RAW[metricKey];
  if (!raw?.length) return null;
  return empiricalPercentile(value, raw);
}

function patchDistributionRawFromOA() {
  const authors = Object.values(_OA.authors || {});
  const fwci = [];
  const h_index = [];
  const output = [];
  const oa_rate = [];
  const cpp = [];
  const q1_pct = [];
  authors.forEach((a) => {
    if (typeof a.fwci === 'number') fwci.push(a.fwci);
    if (typeof a.h_index === 'number') h_index.push(a.h_index);
    if (typeof a.works_count === 'number') output.push(a.works_count);
    if (typeof a.oaRate === 'number') oa_rate.push(a.oaRate);
    if (a.works_count > 0) {
      cpp.push(+((a.cited_by_count || 0) / a.works_count).toFixed(2));
    }
    const q = a.quartile_profile?.q1_pct;
    if (typeof q === 'number') q1_pct.push(q);
  });
  const sort = (arr) => [...arr].sort((x, y) => x - y);
  _DIST_RAW = {
    ..._DIST_RAW,
    fwci: sort(fwci),
    h_index: sort(h_index),
    output: sort(output),
    oa_rate: sort(oa_rate),
    cpp: sort(cpp),
    q1_pct: sort(q1_pct),
  };
}

/** Recalcula researcher_distributions.fwci desde openalex.json (FWCI enriquecido). */
function patchFwciDistributionsFromOA() {
  const authors = _OA.authors || {};
  const fwciVals = Object.values(authors)
    .map((a) => a.fwci)
    .filter((v) => typeof v === 'number');
  if (!fwciVals.length) return;
  const dist = computeDistributionStats(fwciVals);
  _METRICS = {
    ..._METRICS,
    fwci: dist.mean,
    researcher_distributions: {
      ...(_METRICS.researcher_distributions || {}),
      fwci: dist,
    },
  };
}

export function initData(payload = {}) {
  const {
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
  } = payload;
  _DATA = DATA || [];
  _OA = OA || {};
  _AW = AW || [];
  _OD = OD || {};
  _AI = AI || {};
  _COAUTHORS = COAUTHORS || {};
  rebuildCoAuthorIndexes();
  _METRICS = METRICS || {};
  _RES_METRICS = RES_METRICS || {};
  _CITATIONS = CITATIONS || {};
  _DATASETS = DATASETS || {};
  setWorkCitationsIndex(_CITATIONS);

  // Unidades: filas de GET /units (results) o array directo.
  const unitRows = Array.isArray(UNITS?.results)
    ? UNITS.results
    : Array.isArray(UNITS)
      ? UNITS
      : [];
  _UNITS = unitRows.filter((u) => u?.name);

  // Build title index for work enrichment (rebuilt after linkAutoresUta below)
  function rebuildAwByTitle() {
    _AW_BY_TITLE = {};
    (_AW || []).forEach((w) => {
      const k = ((w.t || w.title || '').replace(/<[^>]*>/g, '')).toLowerCase().trim();
      if (k) _AW_BY_TITLE[k] = w;
    });
  }

  rebuildAwByTitle();

  linkAutoresUta(_DATA, _AW);
  rebuildAwByTitle();
  patchFwciDistributionsFromOA();
  patchDistributionRawFromOA();
}

/** Reemplaza obras en memoria tras vinculación (API / link:works). */
export function updateAW(works) {
  _AW = works || [];
  _AW_BY_TITLE = {};
  (_AW || []).forEach((w) => {
    const k = ((w.t || w.title || '').replace(/<[^>]*>/g, '')).toLowerCase().trim();
    if (k) _AW_BY_TITLE[k] = w;
  });
}

function getUtaLinksFromWork(work) {
  const raw = work?.autores_uta;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry) =>
      entry
      && typeof entry === 'object'
      && typeof entry.rut === 'string'
      && entry.rut.trim(),
  );
}

/** Obras de all-works.json vinculadas a un investigador UTA (ORCID confirmado en authorships) */
export function getWorksForResearcher(person) {
  const rut = (person?.id || '').trim();
  const orcid = cleanOrcid(person?.o).toLowerCase();
  if (!rut && !orcid) return [];
  return (_AW || []).filter((w) => {
    const links = getUtaLinksFromWork(w);
    if (!links.length) return false;
    return links.some((link) => {
      if (rut && link.rut === rut) return true;
      const linkOrcid = cleanOrcid(link.orcid).toLowerCase();
      return Boolean(orcid && linkOrcid && linkOrcid === orcid);
    });
  });
}

// ─── Data Accessors ───

export function getData() { return _DATA; }
export function getOA() { return _OA; }
export function getAW() { return _AW; }
export function getOD() { return _OD; }
export function getAI() { return _AI; }
export function getCoAuthors() { return _COAUTHORS; }
export function getMetrics() { return _METRICS; }
export function getResMetrics() { return _RES_METRICS; }
export function getWorkCitationsIndex() { return _CITATIONS; }
export function getInstitution() { return _OA.institution || {}; }
export function getAuthorsOA() { return _OA.authors || {}; }

/** Registros de datasets (type=dataset) cosechados en datasets.json para un ORCID. */
export function getDatasetsForAuthor(orcid) {
  const o = cleanOrcid(orcid);
  if (!o) return [];
  return _DATASETS[o]?.records ?? [];
}

// ─── Computed Values ───

export function getDepartments() {
  if (_UNITS.length) return _UNITS.map((u) => u.name);
  return [...new Set(_DATA.flatMap((p) => (p.dp || []).map((d) => d?.d).filter(Boolean)))].sort();
}

export function getDeptCounts() {
  if (_UNITS.length) {
    return Object.fromEntries(_UNITS.map((u) => [u.name, u.total ?? 0]));
  }
  const c = {};
  _DATA.forEach((p) =>
    (p.dp || []).forEach((d) => {
      if (d?.d) c[d.d] = (c[d.d] || 0) + 1;
    })
  );
  return c;
}

/**
 * Cobertura ORCID por unidad.
 * Preferencia: filas de GET /units (bootstrap → UNITS).
 * Fallback: cómputo sobre _DATA (`o` + `dp[0].d`).
 */
export function getDeptOrcidCoverage() {
  if (_UNITS.length) {
    return Object.fromEntries(
      _UNITS.map((u) => [
        u.name,
        {
          total: u.total ?? 0,
          conOrcid: u.with_orcid ?? 0,
          pct: u.pct != null ? Math.round(Number(u.pct)) : 0,
        },
      ])
    );
  }
  const out = {};
  for (const r of (_DATA || [])) {
    const u = (r.dp || [])[0]?.d;
    if (!u) continue;
    if (!out[u]) out[u] = { total: 0, conOrcid: 0, pct: 0 };
    out[u].total++;
    if (cleanOrcid(r.o)) out[u].conOrcid++;
  }
  for (const u of Object.keys(out)) {
    const e = out[u];
    e.pct = e.total ? Math.round((100 * e.conOrcid) / e.total) : 0;
  }
  return out;
}

export function getOrcidCount() {
  return _DATA.filter((p) => p.o).length;
}

// ─── Work Enrichment ───

export function enrichWork(w) {
  if (!w) return w;
  const raw = w.t || w.title || '';
  const k = raw.replace(/<[^>]*>/g, '').toLowerCase().trim();
  const aw = k ? _AW_BY_TITLE[k] : null;

  const merged = aw ? { ...aw, ...w } : { ...w };
  if (!merged.t && merged.title) merged.t = merged.title;

  return {
    ...w,
    ...merged,
    t: merged.t || merged.title || '',
    y: merged.y ?? aw?.y,
    c: merged.c ?? aw?.c ?? 0,
    s: merged.s || aw?.s || '',
    tp: merged.tp || aw?.tp || '',
    oa: merged.oa !== undefined ? merged.oa : aw?.oa,
    ou: merged.ou || aw?.ou || '',
    d: merged.d || aw?.d || '',
    u: merged.u || aw?.u || '',
    a: merged.a?.length ? merged.a : aw?.a || [],
    topic: merged.topic || aw?.topic || '',
    field: merged.field || aw?.field || '',
    subfield: merged.subfield || aw?.subfield || '',
    sdgs: merged.sdgs?.length ? merged.sdgs : aw?.sdgs || [],
    qi: merged.qi || aw?.qi || '',
    qc: merged.qc || aw?.qc || '',
    fwci: merged.fwci ?? aw?.fwci ?? merged.impact ?? aw?.impact ?? null,
    cited_by_count: merged.cited_by_count ?? aw?.cited_by_count ?? merged.c ?? aw?.c,
    impact: merged.impact ?? aw?.impact ?? merged.fwci ?? aw?.fwci ?? 0,
    pub: merged.pub || aw?.pub || '',
    srcOA: merged.srcOA !== undefined ? merged.srcOA : aw?.srcOA,
    openalex_id: w.openalex_id ?? merged.openalex_id ?? aw?.openalex_id,
  };
}

// ─── Author Lookups ───

function pickQuartileProfile(raw) {
  if (!raw) return null;
  return {
    q1: raw.q1 ?? 0,
    q2: raw.q2 ?? 0,
    q3: raw.q3 ?? 0,
    q4: raw.q4 ?? 0,
    with_quartile: raw.with_quartile ?? 0,
    q1_pct: typeof raw.q1_pct === 'number' ? raw.q1_pct : undefined,
    q1q2_pct: typeof raw.q1q2_pct === 'number' ? raw.q1q2_pct : undefined,
  };
}

export function getAuthorOA(person) {
  const o = cleanOrcid(person?.o);
  const authors = _OA.authors || {};
  if (!o || !authors[o]) return null;
  const a = authors[o];
  const datasetsCount = typeof a.datasetsCount === 'number' ? a.datasetsCount : null;
  const datasetsFetchedAt = a.datasetsFetchedAt ?? null;
  const publicationsCount =
    typeof a.works_count === 'number' ? a.works_count - (datasetsCount ?? 0) : undefined;
  return {
    ...a,
    fwci: a.fwci ?? null,
    fwciN: a.fwciN ?? null,
    oaRate: a.oaRate ?? null,
    fwciFetchedAt: a.fwciFetchedAt ?? null,
    scopusIndexedRate: a.scopusIndexedRate ?? null,
    scopusIndexedN: a.scopusIndexedN ?? null,
    scopusWorksTotal: a.scopusWorksTotal ?? null,
    scopusFetchedAt: a.scopusFetchedAt ?? null,
    quartile_profile: pickQuartileProfile(a.quartile_profile),
    sjrQuartileFetchedAt: a.sjrQuartileFetchedAt ?? null,
    datasetsCount,
    datasetsFetchedAt,
    publicationsCount,
  };
}

/** URL del autor en OpenAlex cuando existe en openalex.json */
export function getResearcherOpenAlexUrl(person) {
  const oa = getAuthorOA(person);
  const raw = oa?.openalex_id;
  if (!raw?.trim()) return null;
  const id = String(raw).replace(/^https?:\/\/openalex\.org\//i, '').trim();
  return id ? `https://openalex.org/${id}` : null;
}

export function getOrcidProfile(person) {
  const o = cleanOrcid(person?.o);
  return o ? (_OD?.profiles || {})[o] : null;
}

export function getCoAuthorProfile(orcid) {
  const key = cleanOrcid(orcid);
  if (!key) return null;
  return _COAUTHORS[key] || null;
}

export function getCoAuthorProfileByOpenAlexId(oaId) {
  const key = parseOpenAlexAuthorId(oaId);
  if (!key) return null;
  return _COAUTHORS_BY_OA.get(key) || null;
}

export { resolveCoAuthorProfile, METRICS_SCOPE_LABELS, buildResearcherMetrics } from './researcherMetrics';
export { getCitationsForWork, buildAllCitations, buildCitation } from './citation/getCitationsForWork';

// ─── Filtering ───

export function filterResearchers({ search = '', dept = '', onlyOrcid = false, sdgFilter = '', areaFilter = '' }) {
  const q = search.toLowerCase().trim();
  const authors = _OA.authors || {};
  const sdgResearchers = _OA.sdg_researchers || {};

  return _DATA.filter((r) => {
    const orcidKey = cleanOrcid(r.o);
    const qOrcid = cleanOrcid(q) || q;
    const nameMatch =
      !q ||
      ((r.f || '') + ' ' + (r.l || '')).toLowerCase().includes(q) ||
      (r.t || '').toLowerCase().includes(q) ||
      (r.e || '').toLowerCase().includes(q) ||
      (orcidKey && orcidKey.toLowerCase().includes(qOrcid.toLowerCase())) ||
      (r.o || '').toLowerCase().includes(q);

    const deptMatch = !dept || (r.dp || []).some((d) => d?.d === dept);
    const orcidMatch = !onlyOrcid || Boolean(orcidKey);
    const sdgMatch =
      !sdgFilter || (orcidKey && (sdgResearchers[sdgFilter] || []).includes(orcidKey));
    const areaMatch =
      !areaFilter ||
      (orcidKey && (authors[orcidKey]?.works || []).some((w) => w.field === areaFilter));

    return nameMatch && deptMatch && orcidMatch && sdgMatch && areaMatch;
  });
}

export function filterWorks({
  search = '',
  year = '',
  type = '',
  oa = false,
  access = '',
  field = '',
  topic = '',
  sdg = '',
} = {}) {
  const q = search.toLowerCase().trim();
  const accessMode = access || (oa ? 'open' : '');
  return (_AW || []).filter((w) => {
    const mt =
      !q ||
      (w.t || '').toLowerCase().includes(q) ||
      (w.a || []).some((a) => a.toLowerCase().includes(q)) ||
      (w.s || '').toLowerCase().includes(q) ||
      (w.pub || '').toLowerCase().includes(q);
    const my = !year || String(w.y) === year;
    const mtp = !type || w.tp === type;
    const moa =
      !accessMode || (accessMode === 'open' ? Boolean(w.oa) : accessMode === 'closed' ? !w.oa : true);
    const mf = !field || w.field === field;
    const mtopic = !topic || w.topic === topic || w.field === topic;
    const ms = !sdg || (w.sdgs && w.sdgs.some((s) => s === sdg));
    return mt && my && mtp && moa && mf && mtopic && ms;
  });
}

/** @param {Array} works @param {{ limit?: number }} opts */
export function buildWorkFacets(works, { limit = 8 } = {}) {
  const years = {};
  const types = {};
  const topics = {};
  const fields = {};
  const publishers = {};
  let open = 0;
  let closed = 0;

  (works || []).forEach((w) => {
    if (w.y != null && w.y !== '') years[w.y] = (years[w.y] || 0) + 1;
    if (w.tp) types[w.tp] = (types[w.tp] || 0) + 1;
    if (w.oa) open += 1;
    else closed += 1;
    const topicKey = w.topic || w.field;
    if (topicKey) topics[topicKey] = (topics[topicKey] || 0) + 1;
    if (w.field) fields[w.field] = (fields[w.field] || 0) + 1;
    if (w.pub) publishers[w.pub] = (publishers[w.pub] || 0) + 1;
  });

  const toSorted = (map, numericKey = false) =>
    Object.entries(map)
      .map(([name, count]) => ({ name: numericKey ? String(name) : name, count }))
      .sort((a, b) => (numericKey ? Number(b.name) - Number(a.name) : b.count - a.count));

  return {
    years: toSorted(years, true),
    types: toSorted(types),
    topics: toSorted(topics),
    fields: toSorted(fields),
    publishers: toSorted(publishers),
    access: [
      { name: 'open', count: open },
      { name: 'closed', count: closed },
    ],
    limit,
  };
}
