import { analyzeResearcher } from '../../api/aiApi';
import type { ResearcherAnalysisStructured } from './types';

export interface GetResearcherSummaryOptions {
  /** Si true, ignora pre-cache y regenera vía Claude */
  force?: boolean;
  researcherId?: string;
}

/** Convierte el JSON estructurado del análisis en un párrafo para la caja inline. */
export function formatResearcherAnalysisAsSummary(
  data: ResearcherAnalysisStructured,
): string | null {
  const parts: string[] = [];

  if (data.lineas_investigacion?.length) {
    const lines = data.lineas_investigacion.slice(0, 4).join(', ');
    parts.push(`Su investigación se centra en ${lines}.`);
  }
  if (data.fortalezas_cientificas?.length) {
    parts.push(data.fortalezas_cientificas.slice(0, 2).join(' '));
  }
  if (data.colaboraciones_destacadas?.length) {
    parts.push(
      `Colaboraciones destacadas: ${data.colaboraciones_destacadas.slice(0, 2).join('; ')}.`,
    );
  }
  if (data.publicaciones_clave?.length) {
    parts.push(
      `Publicaciones clave: ${data.publicaciones_clave.slice(0, 3).join('; ')}.`,
    );
  }
  if (data.oportunidades_colaboracion?.length) {
    parts.push(data.oportunidades_colaboracion[0]);
  }

  const text = parts.join(' ').replace(/\s+/g, ' ').trim();
  return text || null;
}

/**
 * Resumen IA del investigador (lazy + cache).
 * IMPLEMENTACIÓN ACTUAL: pre-cache en ai-data.json o Claude bajo demanda.
 * FUTURO SaaS: fetch a /api/researcher/{orcid}/summary (caché cross-tenant + TTL).
 */
export async function getResearcherSummary(
  orcid: string,
  cached?: string | null,
  options?: GetResearcherSummaryOptions,
): Promise<string | null> {
  const id = orcid?.trim();
  if (!id) return null;

  if (cached?.trim() && !options?.force) {
    return cached.trim();
  }

  try {
    const res = await analyzeResearcher({
      orcid: id,
      researcherId: options?.researcherId,
    });
    if (!res.ok) return null;
    if (res.structured) {
      return formatResearcherAnalysisAsSummary(res.structured);
    }
    const fallback = res.text?.trim();
    return fallback || null;
  } catch {
    return null;
  }

  // --- Implementación FUTURA (SaaS), referencia: ---
  // const res = await fetch(`/api/researcher/${encodeURIComponent(id)}/summary`, {
  //   method: options?.force ? 'POST' : 'GET',
  // });
  // if (!res.ok) return null;
  // const data = await res.json();
  // return typeof data.summary === 'string' ? data.summary : null;
}
