import { cleanOrcid, normalizeAuthorName, getResearcherUtaId } from './helpers.js';

/**
 * Vincula cada obra en AW con IDs UTA (autores_uta) usando nombres, ORCID y DOI/OpenAlex.
 */
export function linkAutoresUta(DATA, AW, OA) {
  const byName = new Map();
  const orcidToId = new Map();
  const idToOrcid = new Map();

  (DATA || []).forEach((r) => {
    const utaId = getResearcherUtaId(r);
    if (!utaId) return;
    const full = normalizeAuthorName(`${r.f || ''} ${r.l || ''}`);
    if (full) byName.set(full, utaId);
    const o = cleanOrcid(r.o);
    if (o) {
      orcidToId.set(o, utaId);
      idToOrcid.set(utaId, o);
    }
  });

  const addResearcherIds = (ids, utaId) => {
    if (!utaId) return;
    ids.add(utaId);
    const o = idToOrcid.get(utaId);
    if (o) ids.add(o);
  };

  const doiToIds = new Map();
  const normDoi = (d) => {
    const raw = (d || '').toLowerCase().trim();
    if (!raw) return '';
    return raw.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
  };

  Object.entries((OA || {}).authors || {}).forEach(([orcid, profile]) => {
    const utaId = orcidToId.get(cleanOrcid(orcid));
    if (!utaId) return;
    (profile.works || []).forEach((w) => {
      const key = normDoi(w.doi || w.d);
      if (!key) return;
      if (!doiToIds.has(key)) doiToIds.set(key, new Set());
      addResearcherIds(doiToIds.get(key), utaId);
    });
  });

  (AW || []).forEach((w) => {
    const ids = new Set(w.autores_uta || []);
    (w.a || []).forEach((author) => {
      addResearcherIds(ids, byName.get(normalizeAuthorName(author)));
    });
    const doiKey = normDoi(w.d);
    if (doiKey && doiToIds.has(doiKey)) {
      doiToIds.get(doiKey).forEach((id) => ids.add(id));
    }
    w.autores_uta = [...ids];
  });
}
