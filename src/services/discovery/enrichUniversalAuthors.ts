/**
 * enrichUniversalAuthors.ts — Enriquecimiento UTA de autores en el
 * descubridor universal.
 *
 * Replica el comportamiento del descubridor local (autores UTA clicables
 * hacia su ficha), pero partiendo de los datos de OpenAlex: cada autor
 * trae su author_id (A…), que cruzamos contra el catálogo UTA vía el
 * reverse lookup ya existente.
 *
 * A diferencia del local (que usa autores_uta precalculado en all-works.json),
 * aquí resolvemos en vivo por author_id — es barato porque el lookup es
 * un Map en memoria, sin fetch.
 */

import { findResearcherByOpenAlexAuthorId, findResearcherByProfileId } from '../../utils/researcherProfile';
import { getData } from '../../utils/dataProcessing';
import type { Researcher } from '../../shared/types';
import type { WorkAuthor } from './universalSearch';

export interface EnrichedAuthor {
  name: string;
  authorId: string | null;
  orcid: string | null;
  position: string | null;
  /** Si el autor es UTA, el Researcher local para abrir su ficha; si no, null */
  utaResearcher: Researcher | null;
}

/**
 * Enriquece la lista de autores de una obra, marcando cuáles son UTA.
 */
export function enrichAuthors(
  authors: WorkAuthor[] | undefined,
  catalog: Researcher[] = getData(),
): EnrichedAuthor[] {
  if (!authors || authors.length === 0) return [];
  return authors.map((a) => {
    let utaResearcher: Researcher | null = null;
    if (a.author_id) {
      utaResearcher = findResearcherByOpenAlexAuthorId(a.author_id, catalog) ?? null;
    }
    if (!utaResearcher && a.orcid) {
      utaResearcher = findResearcherByProfileId(catalog, a.orcid) ?? null;
    }
    return {
      name: a.name,
      authorId: a.author_id ?? null,
      orcid: a.orcid ?? null,
      position: a.position ?? null,
      utaResearcher,
    };
  });
}

/**
 * Badge de liderazgo para autores UTA, según su posición.
 * (Equivalente a getUtaLeadershipLabel del descubridor local.)
 */
export function utaLeadershipLabel(position: string | null): string | null {
  if (position === 'first') return 'Primer autor';
  if (position === 'last') return 'Autor senior';
  return null;
}

/** ¿Hay al menos un autor UTA en la obra? (para decidir si destacar la tarjeta) */
export function hasUtaAuthor(enriched: EnrichedAuthor[]): boolean {
  return enriched.some((a) => a.utaResearcher != null);
}
