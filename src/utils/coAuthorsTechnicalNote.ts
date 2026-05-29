/**
 * Nota técnica — módulo Co-autores / Colaborador internacional
 *
 * El modal (CoAuthorModal) y las métricas de colaboración dependen de obras locales
 * en `all-works.json` vinculadas vía `autores_uta` a investigadores UTA.
 *
 * Si un colaborador tiene muchas colaboraciones UTA (p. ej. conteo ORCID en chips),
 * pero el modal muestra el listado de publicaciones vacío:
 *
 * **Causa probable:** las obras existen en el catálogo del coautor (`coauthor-profiles.json`
 * u OpenAlex), pero no están enlazadas con autores UTA dentro del dataset local.
 *
 * **Acción recomendada:**
 * ```bash
 * npm run link:works
 * ```
 * Luego reconstruir/verificar:
 * - `all-works.json` → campo `autores_uta`
 * - `coauthor-profiles.json`
 * - métricas de colaboración (`resolveCoAuthorProfile` / `researcherMetrics`)
 * - listado en `CoAuthorModal`
 *
 * Las métricas de cabecera por conteo ORCID/coautor pueden existir aunque el listado
 * local quede vacío si falta la vinculación `autores_uta`.
 */

export const COAUTHOR_LINKING_NOTE_MESSAGE =
  'Este colaborador tiene colaboraciones detectadas, pero no hay obras enlazadas en all-works. Ejecute npm run link:works para regenerar vínculos.';

export const COAUTHOR_EMPTY_LIST_TITLE =
  'Sin publicaciones indexadas en colaboración UTA';

export const COAUTHOR_EMPTY_LIST_MESSAGE = COAUTHOR_LINKING_NOTE_MESSAGE;

export const COAUTHOR_TECHNICAL_NOTE = {
  title: 'Nota técnica',
  message: COAUTHOR_LINKING_NOTE_MESSAGE,
  action: 'npm run link:works',
  verify: [
    'all-works.json → autores_uta',
    'coauthor-profiles.json',
    'métricas de colaboración (resolveCoAuthorProfile)',
    'listado en CoAuthorModal',
  ],
} as const;

/** Cuándo mostrar la nota: listado colaboración vacío con señal de datos globales/ORCID. */
export function shouldShowCoAuthorLinkingNote(input: {
  worksLength: number;
  publicationListScope?: string;
  globalWorksCount?: number;
  orcid?: string;
}): boolean {
  if (input.worksLength > 0) return false;
  if (input.publicationListScope === 'global_openalex') return false;
  return Boolean(
    input.orcid ||
    (input.globalWorksCount ?? 0) > 0
  );
}
