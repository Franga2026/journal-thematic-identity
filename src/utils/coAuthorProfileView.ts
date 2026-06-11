import type { CoAuthorProfile, Researcher, Work } from '../shared/types';
import { fwciIsEligible } from '../shared/metrics/fwci';
import { SDG_NAME_TO_NUMBER } from './constants';
import { getAuthorsOA } from './dataProcessing';
import { cleanOrcid, stripTags } from './helpers';
import { findResearcherByProfileId } from './researcherProfile';
import { getWorkOpenAlexFwci } from './workMetrics';
import { getUtaLinks } from './utaAuthorLinks';

export type CoAuthorModalTab = 'resumen' | 'publicaciones' | 'colaboracion' | 'impacto' | 'red';

export type PubSortKey = 'recent' | 'cited' | 'oldest';

export function getCoAuthorOrcidUrl(profile: CoAuthorProfile): string | null {
  const orcid = cleanOrcid(profile.orcid);
  return orcid ? `https://orcid.org/${orcid}` : null;
}

export function getCoAuthorOpenAlexAuthorUrl(profile: CoAuthorProfile): string | null {
  const raw = (profile.oaId || '').trim();
  if (!raw) return null;
  const id = raw.replace(/^https?:\/\/openalex\.org\//i, '').trim();
  if (/^A\d+$/i.test(id)) return `https://openalex.org/${id.toUpperCase()}`;
  return null;
}

export function countUtaCoauthorsFromWorks(works: Work[]): number {
  const ids = new Set<string>();
  works.forEach((w) => {
    getUtaLinks(w).forEach((link) => {
      if (link.rut.trim()) ids.add(link.rut.trim());
    });
  });
  return ids.size;
}

export interface UtaCollaboratorLink {
  id: string;
  name: string;
  researcher?: Researcher;
}

export function listUtaCollaboratorsFromWorks(
  works: Work[],
  catalog: Researcher[]
): UtaCollaboratorLink[] {
  const ids = new Set<string>();
  works.forEach((w) => {
    getUtaLinks(w).forEach((link) => {
      if (link.rut.trim()) ids.add(link.rut.trim());
    });
  });
  const out: UtaCollaboratorLink[] = [];
  ids.forEach((id) => {
    const researcher = findResearcherByProfileId(catalog, id);
    const name = researcher
      ? `${researcher.f || ''} ${researcher.l || ''}`.trim()
      : id;
    out.push({ id, name, researcher });
  });
  return out.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function sortCoAuthorWorks(works: Work[], sort: PubSortKey): Work[] {
  const copy = [...works];
  if (sort === 'cited') {
    return copy.sort((a, b) => (b.c ?? 0) - (a.c ?? 0));
  }
  if (sort === 'oldest') {
    return copy.sort((a, b) => (Number(a.y) || 0) - (Number(b.y) || 0));
  }
  return copy.sort((a, b) => (Number(b.y) || 0) - (Number(a.y) || 0));
}

export function workPublisherLabel(w: Work): string {
  return (w.s || w.pub || '').trim() || 'Fuente no indicada';
}

export function workTypeLabel(w: Work): string {
  const tp = w.tp || '';
  const map: Record<string, string> = {
    article: 'Artículo',
    'journal-article': 'Artículo',
    book: 'Libro',
    'book-chapter': 'Capítulo',
    proceedings: 'Proceedings',
  };
  return map[tp] || tp || 'Publicación';
}

export function firstSdgRoute(sdgName?: string): string | null {
  if (!sdgName) return null;
  const num = SDG_NAME_TO_NUMBER[sdgName as keyof typeof SDG_NAME_TO_NUMBER];
  return num ? `/ods/${num}` : null;
}

export function formatDoiLink(doi?: string): string | null {
  const raw = (doi || '').trim();
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  return `https://doi.org/${raw.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}`;
}

export function workTitlePlain(w: Work): string {
  return stripTags(w.t) || 'Sin título';
}

export interface CoAuthorKpiCard {
  key: string;
  label: string;
  display: string;
  positive?: boolean;
  /** KPI Datasets con N > 0: expandible para listar obras type=dataset. */
  expandable?: boolean;
}

function lookupOpenAlexAuthorMetrics(orcid?: string) {
  const key = cleanOrcid(orcid);
  if (!key) return null;
  const a = getAuthorsOA()[key];
  if (!a) return null;
  return {
    fwci: typeof a.fwci === 'number' ? a.fwci : null,
    datasetsCount: typeof a.datasetsCount === 'number' ? a.datasetsCount : null,
    oaRate: typeof a.oaRate === 'number' ? a.oaRate : null,
  };
}

function meanFwciFromWorks(works: Work[]): number | null {
  const values: number[] = [];
  works.forEach((w) => {
    if (!fwciIsEligible(w)) return;
    const fwci = getWorkOpenAlexFwci(w);
    if (fwci !== null) values.push(fwci);
  });
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function oaRateFromWorks(works: Work[]): number | null {
  const known = works.filter((w) => w.oa === true || w.oa === false);
  if (!known.length) return null;
  return known.filter((w) => w.oa === true).length / known.length;
}

export interface BuildCoAuthorKpiOptions {
  /** Conteo OpenAlex type=dataset del colaborador (0 es válido). */
  datasetsCount?: number;
  datasetsLoading?: boolean;
}

/** KPIs del modal de coautor. Datasets siempre visible cuando hay conteo OpenAlex (incl. 0). */
export function buildCoAuthorKpiCards(
  profile: CoAuthorProfile,
  utaCoauthorCount: number,
  options: BuildCoAuthorKpiOptions = {},
): CoAuthorKpiCard[] {
  const cards: CoAuthorKpiCard[] = [];
  const works = profile.works || [];
  const oaMetrics = lookupOpenAlexAuthorMetrics(profile.orcid);
  const { datasetsCount, datasetsLoading } = options;

  if (typeof profile.works_count === 'number' && profile.works_count > 0) {
    cards.push({
      key: 'pubs',
      label: 'Publicaciones',
      display: profile.works_count.toLocaleString(),
    });
  }

  if (datasetsLoading) {
    cards.push({ key: 'datasets', label: 'Datasets', display: '…', expandable: false });
  } else {
    const dsCount = typeof datasetsCount === 'number' ? datasetsCount : 0;
    cards.push({
      key: 'datasets',
      label: 'Datasets',
      display: dsCount.toLocaleString(),
      expandable: dsCount > 0,
    });
  }

  if (typeof profile.cited_by_count === 'number' && profile.cited_by_count > 0) {
    cards.push({
      key: 'cites',
      label: 'Citas',
      display: profile.cited_by_count.toLocaleString(),
    });
  }

  if (
    typeof profile.works_count === 'number'
    && profile.works_count > 0
    && typeof profile.cited_by_count === 'number'
  ) {
    cards.push({
      key: 'cpp',
      label: 'Citas/pub',
      display: (profile.cited_by_count / profile.works_count).toFixed(1),
    });
  }

  if (typeof profile.h_index === 'number' && profile.h_index > 0) {
    cards.push({
      key: 'h_index',
      label: 'H-index',
      display: String(profile.h_index),
    });
  }

  const fwci = oaMetrics?.fwci ?? meanFwciFromWorks(works);
  if (typeof fwci === 'number') {
    cards.push({
      key: 'fwci',
      label: 'FWCI',
      display: fwci.toFixed(2),
      positive: fwci >= 1,
    });
  }

  const oaRate = oaMetrics?.oaRate ?? oaRateFromWorks(works);
  if (typeof oaRate === 'number') {
    cards.push({
      key: 'oa',
      label: 'Acceso abierto',
      display: `${Math.round(oaRate * 100)}%`,
    });
  }

  cards.push({
    key: 'uta',
    label: 'Coautores UTA',
    display: utaCoauthorCount.toLocaleString(),
    expandable: utaCoauthorCount > 0,
  });

  return cards;
}
