/**
 * autocomplete.ts — Servicio de búsqueda predictiva (type-ahead).
 * Consume el endpoint /autocomplete del proxy (puerto 8002).
 *
 * Alimenta las predicciones A (términos) y C (entidades).
 * Incluye debounce para no llamar a OpenAlex en cada tecla.
 */

import type { OpenAlexAuthorSummary } from '../../shared/types/openalex';
import { cleanOrcid } from '../../utils/helpers';
import { parseOpenAlexAuthorId } from '../../utils/openAlexAuthorId';
import { isUtaOpenAlexAuthorId } from '../../utils/researcherProfile';

const API_BASE =
  (import.meta as any).env?.VITE_DISCOVERY_API_URL || 'http://localhost:8002';

export type EntityType =
  | 'work' | 'author' | 'source' | 'institution' | 'concept' | 'topic' | 'keyword';

export interface AutocompleteItem {
  id: string;
  display_name: string;
  hint: string | null;
  entity_type: EntityType | string;
  cited_by_count: number;
  works_count: number;
  external_id: string | null;
}

export interface AutocompleteResponse {
  query: string;
  results: AutocompleteItem[];
  cached: boolean;
}

export const ENTITY_STYLE: Record<string, { color: string; icon: string; label: string }> = {
  source:      { color: '#0E7E9E', icon: 'J', label: 'Revista' },
  author:      { color: '#534AB7', icon: 'A', label: 'Autor' },
  institution: { color: '#15803D', icon: 'I', label: 'Institución' },
  concept:     { color: '#D97706', icon: 'C', label: 'Concepto' },
  topic:       { color: '#D97706', icon: 'T', label: 'Tema' },
  keyword:     { color: '#64748B', icon: 'K', label: 'Término' },
  work:        { color: '#5F5E5A', icon: 'W', label: 'Obra' },
};

const DEFAULT_ENTITY_STYLE = { color: '#94A3B8', icon: '·', label: 'Sugerencia' };

export function getEntityStyle(entityType: string) {
  return ENTITY_STYLE[entityType] ?? DEFAULT_ENTITY_STYLE;
}

const _cache = new Map<string, AutocompleteItem[]>();

export async function fetchAutocomplete(
  q: string,
  entity: string = '',
  limit: number = 8,
  signal?: AbortSignal,
): Promise<AutocompleteItem[]> {
  const query = q.trim();
  if (query.length < 1) return [];

  const cacheKey = `${entity}:${query.toLowerCase()}:${limit}`;
  const hit = _cache.get(cacheKey);
  if (hit) return hit;

  const usp = new URLSearchParams({ q: query, limit: String(limit) });
  if (entity) usp.set('entity', entity);

  try {
    const res = await fetch(`${API_BASE}/autocomplete?${usp.toString()}`, { signal });
    if (!res.ok) return [];
    const data: AutocompleteResponse = await res.json();
    _cache.set(cacheKey, data.results);
    return data.results;
  } catch (e) {
    if ((e as Error).name === 'AbortError') return [];
    return [];
  }
}

export function createDebouncedAutocomplete(
  onResults: (items: AutocompleteItem[]) => void,
  delayMs: number = 300,
  entity: string = '',
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: AbortController | null = null;

  return (q: string) => {
    if (timer) clearTimeout(timer);
    if (controller) controller.abort();

    const query = q.trim();
    if (query.length < 2) {
      onResults([]);
      return;
    }

    timer = setTimeout(async () => {
      controller = new AbortController();
      const items = await fetchAutocomplete(query, entity, 8, controller.signal);
      onResults(items);
    }, delayMs);
  };
}

/** Convierte sugerencia de autor del autocomplete en resumen para OpenAlexResearcherProfile. */
export function autocompleteItemToAuthorSummary(item: AutocompleteItem): OpenAlexAuthorSummary {
  const openAlexId = parseOpenAlexAuthorId(item.id) || item.id;
  const orcid = item.external_id?.includes('orcid')
    ? cleanOrcid(item.external_id)
    : undefined;
  return {
    id: openAlexId,
    openAlexId,
    display_name: item.display_name,
    orcid: orcid || undefined,
    cited_by_count: item.cited_by_count,
    works_count: item.works_count,
    institution: item.hint?.trim() || undefined,
  };
}

/** Etiqueta de acción al elegir un autor en el type-ahead. */
export function getAuthorAutocompleteAction(authorId: string): string {
  return isUtaOpenAlexAuthorId(authorId)
    ? 'Ver ficha completa UTA'
    : 'Ver obras de este autor';
}
