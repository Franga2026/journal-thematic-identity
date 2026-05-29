import { cleanOrcid, normalizeAuthorName, getResearcherUtaId } from './helpers.js';
import { setWorkCitationsIndex } from './citation/citationsStore.ts';
import { linkAutoresUta } from './linkAutoresUta.js';

export { getResearcherUtaId } from './helpers.js';
export { linkAutoresUta } from './linkAutoresUta.js';

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
export function initData({ DATA, OA, AW, OD, AI, COAUTHORS, METRICS, RES_METRICS, CITATIONS }) {
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
  setWorkCitationsIndex(_CITATIONS);

  // Build title index for work enrichment
  _AW_BY_TITLE = {};
  (_AW || []).forEach((w) => {
    const k = ((w.t || '').replace(/<[^>]*>/g, '')).toLowerCase().trim();
    if (k) _AW_BY_TITLE[k] = w;
  });

  linkAutoresUta(_DATA, _AW, _OA);
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

/** Obras de all-works.json vinculadas a un investigador UTA */
export function getWorksForResearcher(person) {
  const utaId = getResearcherUtaId(person);
  if (!utaId) return [];
  const orcid = cleanOrcid(person?.o);
  return (_AW || []).filter((w) => {
    const linked = w.autores_uta || [];
    if (!linked.length) return false;
    return linked.includes(utaId) || Boolean(orcid && linked.includes(orcid));
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

// ─── Computed Values ───

export function getDepartments() {
  return [...new Set(_DATA.flatMap((p) => (p.dp || []).map((d) => d?.d).filter(Boolean)))].sort();
}

export function getDeptCounts() {
  const c = {};
  _DATA.forEach((p) =>
    (p.dp || []).forEach((d) => {
      if (d?.d) c[d.d] = (c[d.d] || 0) + 1;
    })
  );
  return c;
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
    impact: merged.impact ?? aw?.impact ?? 0,
    pub: merged.pub || aw?.pub || '',
    srcOA: merged.srcOA !== undefined ? merged.srcOA : aw?.srcOA,
  };
}

// ─── Author Lookups ───

export function getAuthorOA(person) {
  const o = cleanOrcid(person?.o);
  const authors = _OA.authors || {};
  return o ? authors[o] : null;
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

export function getResearcherMetrics(person) {
  const o = cleanOrcid(person?.o);
  return o ? _RES_METRICS[o] || {} : {};
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
