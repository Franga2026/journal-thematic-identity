import type { GlobalProfile } from '../../shared/types/globalProfile';

/**
 * Devuelve el perfil global (carrera completa OpenAlex) de un coautor.
 * IMPLEMENTACIÓN ACTUAL: lee el `global_profile` pre-cacheado en coauthor-profiles.
 * FUTURO SaaS: reemplazar el cuerpo por fetch a /api/coauthor/{orcid}/global
 * (caché cross-tenant + TTL en backend). La firma NO cambia.
 */
export async function getCoAuthorGlobalProfile(
  orcid: string | null | undefined,
  cached?: GlobalProfile | null,
): Promise<GlobalProfile | null> {
  void orcid;
  return cached ?? null;
  // --- Implementación FUTURA (SaaS), referencia: ---
  // if (!orcid) return null;
  // const res = await fetch(`/api/coauthor/${encodeURIComponent(orcid)}/global`);
  // if (!res.ok) return null;
  // return res.json();
}
