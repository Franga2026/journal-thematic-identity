import type { CoAuthorProfile, Researcher, Work } from '../shared/types';
import { SDG_NAME_TO_NUMBER } from './constants';
import { cleanOrcid, stripTags } from './helpers';
import { findResearcherByProfileId } from './researcherProfile';

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
    (w.autores_uta || []).forEach((id) => {
      const t = (id || '').trim();
      if (t) ids.add(t);
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
    (w.autores_uta || []).forEach((id) => {
      const t = (id || '').trim();
      if (t) ids.add(t);
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
