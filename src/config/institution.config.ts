/**
 * Configuración de la institución para el descubridor universal.
 *
 * Pensado para multi-institución (visión SaaS): el descubridor universal es
 * común, y este archivo define a qué portal institucional pertenece la
 * instancia actual. El chip de retorno y los textos leen de aquí.
 *
 * En el futuro, esto podría venir de una variable de entorno, del subdominio,
 * o de un endpoint de configuración por tenant.
 */

export interface InstitutionConfig {
  /** Nombre corto para el chip de retorno (ej. "UTA"). */
  shortName: string;
  /** Nombre completo (ej. "Universidad de Tarapacá"). */
  fullName: string;
  /** Ruta a la que vuelve el chip de retorno. */
  returnPath: string;
}

export const INSTITUTION: InstitutionConfig = {
  shortName: 'UTA',
  fullName: 'Universidad de Tarapacá',
  returnPath: '/perfiles',
};
