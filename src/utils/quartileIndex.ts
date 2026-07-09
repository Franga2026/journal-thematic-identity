// =============================================================================
// quartileIndex.ts — Mapa ISSN → cuartil (SJR / Scimago), lado NODE
// -----------------------------------------------------------------------------
// Fuente: Scimago Journal Rank (SJR) 2025 — descarga libre de scimagojr.com.
// Derivado del archivo oficial; "SJR Best Quartile" por revista.
//
// NO importar en el front: usa este módulo en el script de enriquecimiento,
// que escribe el quartile_profile ya calculado por autor.
// =============================================================================

import { readFileSync } from 'node:fs';
import {
  getQuartile,
  getQuartileMatch,
  makeGetQuartile,
  normIssn,
  type Quartile,
} from './quartileCore';

export type { Quartile } from './quartileCore';
export { getQuartile, getQuartileMatch, makeGetQuartile, normIssn };

/** Carga el mapa ISSN → cuartil desde sjr-2025-quartiles.json. */
export function loadQuartileMap(jsonPath: string): Map<string, Quartile> {
  const obj = JSON.parse(readFileSync(jsonPath, 'utf8')) as Record<string, Quartile>;
  return new Map(Object.entries(obj));
}
