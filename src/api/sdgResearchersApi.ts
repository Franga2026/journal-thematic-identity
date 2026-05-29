import type { SdgResearchersApiResponse } from '../shared/types/sdgResearcher';
import { getResearchersBySdg, type SdgRegionScope } from '../services/sdg/getResearchersBySdg';

/** Normaliza id desde ruta (string | number) */
function idNum(sdgId: number | string): number {
  return typeof sdgId === 'string' ? parseInt(sdgId, 10) : sdgId;
}

/**
 * Capa API: en el cliente invoca el servicio directamente (evita respuestas HTML del SPA en /api).
 * En dev, el middleware Vite expone las mismas rutas para integraciones externas.
 */
function fetchResearchers(sdgId: number | string, scope: SdgRegionScope): Promise<SdgResearchersApiResponse> {
  return getResearchersBySdg(idNum(sdgId), scope);
}

export function getLocalResearchers(sdgId: number | string): Promise<SdgResearchersApiResponse> {
  return fetchResearchers(sdgId, 'local');
}

export function getIberoamericaResearchers(sdgId: number | string): Promise<SdgResearchersApiResponse> {
  return fetchResearchers(sdgId, 'iberoamerica');
}

export function getGlobalResearchers(sdgId: number | string): Promise<SdgResearchersApiResponse> {
  return fetchResearchers(sdgId, 'global');
}

export { getResearchersBySdg };
