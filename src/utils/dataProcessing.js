import { cleanOrcid } from './helpers';

// These will be initialized with actual data imports
let _DATA = [];
let _OA = {};
let _AW = [];
let _OD = {};
let _AI = {};
let _COAUTHORS = {};
let _METRICS = {};
let _RES_METRICS = {};
let _AW_BY_TITLE = {};

/**
 * Initialize all data sources. Call once at app startup.
 */
export function initData({ DATA, OA, AW, OD, AI, COAUTHORS, METRICS, RES_METRICS }) {
  _DATA = DATA || [];
  _OA = OA || {};
  _AW = AW || [];
  _OD = OD || {};
  _AI = AI || {};
  _COAUTHORS = COAUTHORS || {};
  _METRICS = METRICS || {};
  _RES_METRICS = RES_METRICS || {};

  // Build title index for work enrichment
  _AW_BY_TITLE = {};
  (_AW || []).forEach((w) => {
    const k = ((w.t || '').replace(/<[^>]*>/g, '')).toLowerCase().trim();
    if (k) _AW_BY_TITLE[k] = w;
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
  if (!aw) return w;

  return {
    t: w.t || aw.t,
    y: w.y || aw.y,
    c: w.c || aw.c,
    s: w.s || aw.s,
    tp: w.tp || aw.tp,
    oa: w.oa !== undefined ? w.oa : aw.oa,
    ou: w.ou || aw.ou || '',
    d: w.d || aw.d || '',
    u: w.u || aw.u || '',
    a: w.a || aw.a || [],
    topic: w.topic || aw.topic || '',
    field: w.field || aw.field || '',
    subfield: w.subfield || aw.subfield || '',
    sdgs: w.sdgs || aw.sdgs || [],
    qi: w.qi || aw.qi || '',
    qc: w.qc || aw.qc || '',
    impact: w.impact || aw.impact || 0,
    pub: w.pub || aw.pub || '',
    srcOA: w.srcOA !== undefined ? w.srcOA : aw.srcOA,
  };
}

// ─── Author Lookups ───

export function getAuthorOA(person) {
  const o = cleanOrcid(person?.o);
  const authors = _OA.authors || {};
  return o ? authors[o] : null;
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
  return orcid ? _COAUTHORS[orcid] : null;
}

// ─── Filtering ───

export function filterResearchers({ search = '', dept = '', onlyOrcid = false, sdgFilter = '', areaFilter = '' }) {
  const q = search.toLowerCase().trim();
  const authors = _OA.authors || {};
  const sdgResearchers = _OA.sdg_researchers || {};

  return _DATA.filter((r) => {
    const nameMatch =
      !q ||
      ((r.f || '') + ' ' + (r.l || '')).toLowerCase().includes(q) ||
      (r.t || '').toLowerCase().includes(q) ||
      (r.e || '').toLowerCase().includes(q) ||
      (r.o || '').includes(q);

    const deptMatch = !dept || (r.dp || []).some((d) => d?.d === dept);
    const orcidMatch = !onlyOrcid || r.o;
    const sdgMatch = !sdgFilter || (sdgResearchers[sdgFilter] || []).includes((r.o || '').trim());
    const areaMatch =
      !areaFilter || (r.o && (authors[r.o.trim()]?.works || []).some((w) => w.field === areaFilter));

    return nameMatch && deptMatch && orcidMatch && sdgMatch && areaMatch;
  });
}

export function filterWorks({ search = '', year = '', type = '', oa = false, field = '', sdg = '' }) {
  const q = search.toLowerCase();
  return (_AW || []).filter((w) => {
    const mt = !q || (w.t || '').toLowerCase().includes(q) || (w.a || []).some((a) => a.toLowerCase().includes(q)) || (w.s || '').toLowerCase().includes(q);
    const my = !year || String(w.y) === year;
    const mtp = !type || w.tp === type;
    const moa = !oa || w.oa;
    const mf = !field || w.field === field;
    const ms = !sdg || (w.sdgs && w.sdgs.some((s) => s === sdg));
    return mt && my && mtp && moa && mf && ms;
  });
}
