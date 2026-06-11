import type { Researcher, UtaAuthorLink, Work } from '../shared/types';
import { cleanOrcid } from './helpers';
import { parseOpenAlexAuthorId } from './openAlexAuthorId';
import { buildAuthorIdAttributionMaps } from './orcidAuthorIdMap';
import type { OrcidAuthorIdMapFile } from './orcidAuthorIdMap';
import orcidAuthorIdMapFile from '../data/orcid-authorid-map.json';
import { getPublicationAuthorships } from './publicationAuthorships';

export type { UtaAuthorLink };

/** Normaliza ORCID para comparación (sin URL, minúsculas). */
export function normOrcid(value?: string | null): string {
  return cleanOrcid(value || '').toLowerCase();
}

/** Lee autores_uta como objetos UtaAuthorLink (ignora entradas legacy string). */
export function getUtaLinks(work: Work | null | undefined): UtaAuthorLink[] {
  const raw = work?.autores_uta;
  if (!Array.isArray(raw) || !raw.length) return [];
  return raw.filter(
    (entry): entry is UtaAuthorLink =>
      typeof entry === 'object'
      && entry != null
      && typeof entry.author_id === 'string'
      && entry.author_id.trim().length > 0
      && typeof entry.rut === 'string'
      && entry.rut.trim().length > 0
      && typeof entry.orcid === 'string'
      && typeof entry.name === 'string'
      && typeof entry.author_index === 'number',
  );
}

export function dedupeUtaLinks(links: UtaAuthorLink[]): UtaAuthorLink[] {
  const seen = new Set<string>();
  const out: UtaAuthorLink[] = [];
  for (const link of links) {
    const key = `${link.rut}|${parseOpenAlexAuthorId(link.author_id)}|${link.author_index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link);
  }
  return out;
}

/** ¿La obra está vinculada a este investigador UTA (por RUT u ORCID del link)? */
export function workHasResearcher(work: Work, researcher: Researcher): boolean {
  const rut = (researcher.id || '').trim();
  const orcid = normOrcid(researcher.o);
  if (!rut && !orcid) return false;
  return getUtaLinks(work).some(
    (link) => (rut && link.rut === rut) || (orcid && normOrcid(link.orcid) === orcid),
  );
}

/** ORCIDs únicos en autores_uta de una obra. */
export function orcidsFromUtaLinks(work: Work): Set<string> {
  const orcids = new Set<string>();
  for (const link of getUtaLinks(work)) {
    const o = normOrcid(link.orcid);
    if (o) orcids.add(o);
  }
  return orcids;
}

export type UtaAuthorMatch = {
  researcher: Researcher;
  link: UtaAuthorLink;
};

/**
 * Empareja un autor de la obra con un link confirmado por author.id.
 * Solo por author_index + nombre exacto + author.id del authorship.
 */
export function matchAuthorToUtaLink(
  work: Work,
  authorName: string,
  authorIndex: number,
  catalog: Researcher[],
): UtaAuthorMatch | null {
  const name = authorName.trim();
  if (!name) return null;

  const authorships = getPublicationAuthorships(work) as Array<{
    author?: { id?: string; display_name?: string };
  }>;
  const authAuthorId = parseOpenAlexAuthorId(authorships[authorIndex]?.author?.id);

  for (const link of getUtaLinks(work)) {
    if (link.author_index !== authorIndex) continue;
    if (link.name.trim() !== name) continue;
    if (authAuthorId && parseOpenAlexAuthorId(link.author_id) !== authAuthorId) continue;
    const researcher = catalog.find((r) => (r.id || '').trim() === link.rut);
    if (!researcher) continue;
    const catalogOrcid = normOrcid(researcher.o);
    if (catalogOrcid && normOrcid(link.orcid) !== catalogOrcid) continue;
    return { researcher, link };
  }
  return null;
}

/** Construye autores_uta desde authorships × cache ORCID→author.id (sin fuzzy). */
export function buildUtaLinksFromAuthorships(
  work: Work,
  catalog: Researcher[],
  mapFile: OrcidAuthorIdMapFile = orcidAuthorIdMapFile as OrcidAuthorIdMapFile,
): UtaAuthorLink[] {
  const { utaAuthorIds, reverseByAuthorId, conflicts } = buildAuthorIdAttributionMaps(
    catalog,
    mapFile?.map || {},
  );
  const conflictIds = new Set(conflicts.map((c) => c.author_id));

  const links: UtaAuthorLink[] = [];
  const authorships = getPublicationAuthorships(work) as Array<{
    author?: { id?: string; display_name?: string; orcid?: string | null };
  }>;

  authorships.forEach((auth, authorIndex) => {
    const authorId = parseOpenAlexAuthorId(auth.author?.id);
    const name = (auth.author?.display_name || '').trim();
    if (!authorId || !name) return;
    if (!utaAuthorIds.has(authorId) || conflictIds.has(authorId)) return;

    const uta = reverseByAuthorId.get(authorId);
    if (!uta) return;

    links.push({
      author_id: authorId,
      orcid: uta.orcid,
      rut: uta.rut,
      name,
      author_index: authorIndex,
    });
  });

  return dedupeUtaLinks(links);
}
