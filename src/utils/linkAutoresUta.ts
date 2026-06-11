import type { Researcher, UtaAuthorLink } from '../shared/types';
import { buildAuthorIdAttributionMaps } from './orcidAuthorIdMap';
import type { OrcidAuthorIdMapFile } from './orcidAuthorIdMap';
import { parseOpenAlexAuthorId } from './openAlexAuthorId';
import orcidAuthorIdMapFile from '../data/orcid-authorid-map.json';

function getAuthorships(work: { authorships?: unknown[] }): Array<{
  author?: { id?: string; display_name?: string; orcid?: string | null };
}> {
  if (Array.isArray(work.authorships) && work.authorships.length > 0) {
    return work.authorships as Array<{
      author?: { id?: string; display_name?: string; orcid?: string | null };
    }>;
  }
  return [];
}

/**
 * Vincula autores_uta por authorship.author.id (OpenAlex).
 * Los author.id provienen del cache ORCID→author.id (ORCID-mandatorio, sin fuzzy).
 */
export function linkAutoresUta(
  DATA: Researcher[],
  AW: Array<{ authorships?: unknown[]; autores_uta?: UtaAuthorLink[] }>,
  mapFile: OrcidAuthorIdMapFile = orcidAuthorIdMapFile as OrcidAuthorIdMapFile,
): { conflicts: ReturnType<typeof buildAuthorIdAttributionMaps>['conflicts'] } {
  const { utaAuthorIds, reverseByAuthorId, conflicts } = buildAuthorIdAttributionMaps(
    DATA,
    mapFile?.map || {},
  );

  const conflictIds = new Set(conflicts.map((c) => c.author_id));

  (AW || []).forEach((w) => {
    const links: UtaAuthorLink[] = [];
    const seen = new Set<string>();

    const authorships = getAuthorships(w);
    authorships.forEach((raw, authorIndex) => {
      const author = raw?.author;
      const authorId = parseOpenAlexAuthorId(author?.id);
      const name = (author?.display_name || '').trim();
      if (!authorId || !name) return;
      if (!utaAuthorIds.has(authorId)) return;
      if (conflictIds.has(authorId)) return;

      const uta = reverseByAuthorId.get(authorId);
      if (!uta) return;

      const dedupeKey = `${uta.rut}|${authorId}|${authorIndex}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      links.push({
        author_id: authorId,
        orcid: uta.orcid,
        rut: uta.rut,
        name,
        author_index: authorIndex,
      });
    });

    if (authorships.length > 0) {
      w.autores_uta = links;
    }
  });

  return { conflicts };
}
