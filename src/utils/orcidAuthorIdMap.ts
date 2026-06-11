import type { Researcher } from '../shared/types';
import { cleanOrcid } from './helpers';
import { parseOpenAlexAuthorId } from './openAlexAuthorId';

export type AuthorIdProvenance = 'orcid' | 'alias_uta_ror' | 'alias_coauthors' | 'authorship_orcid';

export type OrcidAuthorIdMapFile = {
  fetched_at?: string;
  map: Record<string, string[]>;
  /** author.id → origen del vínculo por ORCID de catálogo */
  provenance?: Record<string, Record<string, AuthorIdProvenance>>;
  stats?: {
    orcids_resolved?: number;
    orcids_unresolved?: number;
    orcids_multi_author?: number;
    author_id_conflicts?: number;
    aliases_accepted?: number;
    aliases_rejected?: number;
  };
};

export type UtaAuthorAttribution = {
  rut: string;
  orcid: string;
  name: string;
};

export type AuthorIdConflict = {
  author_id: string;
  entries: UtaAuthorAttribution[];
};

export function normOrcidKey(value?: string | null): string {
  return cleanOrcid(value || '').toLowerCase();
}

/** Construye reverse map author.id → investigador UTA (desde ORCID verificado en catálogo). */
export function buildAuthorIdAttributionMaps(
  catalog: Researcher[],
  orcidMap: Record<string, string[]>,
): {
  utaAuthorIds: Set<string>;
  reverseByAuthorId: Map<string, UtaAuthorAttribution>;
  conflicts: AuthorIdConflict[];
  unresolvedOrcids: string[];
  multiAuthorOrcids: string[];
} {
  const reverseByAuthorId = new Map<string, UtaAuthorAttribution>();
  const conflicts: AuthorIdConflict[] = [];
  const unresolvedOrcids: string[] = [];
  const multiAuthorOrcids: string[] = [];
  const utaAuthorIds = new Set<string>();

  for (const researcher of catalog) {
    const rut = (researcher.id || '').trim();
    const orcidKey = normOrcidKey(researcher.o);
    if (!rut || !orcidKey) continue;

    const authorIds = orcidMap[orcidKey] || orcidMap[cleanOrcid(researcher.o)] || [];
    if (!authorIds.length) {
      unresolvedOrcids.push(orcidKey);
      continue;
    }
    if (authorIds.length > 1) {
      multiAuthorOrcids.push(orcidKey);
    }

    const attribution: UtaAuthorAttribution = {
      rut,
      orcid: cleanOrcid(researcher.o),
      name: `${researcher.f || ''} ${researcher.l || ''}`.trim(),
    };

    for (const rawId of authorIds) {
      const authorId = parseOpenAlexAuthorId(rawId);
      if (!authorId) continue;

      const existing = reverseByAuthorId.get(authorId);
      if (existing && existing.rut !== rut) {
        const conflict = conflicts.find((c) => c.author_id === authorId);
        if (conflict) {
          if (!conflict.entries.some((e) => e.rut === rut)) conflict.entries.push(attribution);
        } else {
          conflicts.push({ author_id: authorId, entries: [existing, attribution] });
        }
        continue;
      }

      reverseByAuthorId.set(authorId, attribution);
      utaAuthorIds.add(authorId);
    }
  }

  return {
    utaAuthorIds,
    reverseByAuthorId,
    conflicts,
    unresolvedOrcids,
    multiAuthorOrcids,
  };
}
