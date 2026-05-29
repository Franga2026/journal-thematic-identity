import type { Researcher } from '../shared/types';
import type { OpenAlexAuthorSummary } from '../shared/types/openalex';
import { cleanOrcid } from './helpers';

/** ORCID de 16 dígitos (con guiones) desde URL OpenAlex */
export function extractOrcidFromOpenAlex(orcidField: string | null | undefined): string | undefined {
  if (!orcidField?.trim()) return undefined;
  const cleaned = cleanOrcid(orcidField);
  return cleaned || undefined;
}

/** URL pública del registro ORCID */
export function getOrcidRecordUrl(orcid?: string | null): string | null {
  const id = cleanOrcid(orcid);
  return id ? `https://orcid.org/${id}` : null;
}

/** Busca investigador UTA por RUT, id o ORCID */
export function findResearcherByProfileId(data: Researcher[], profileId: string): Researcher | undefined {
  const key = profileId.trim();
  if (!key) return undefined;
  const orcidKey = cleanOrcid(key);

  return data.find((r) => {
    if (r.id && r.id.trim() === key) return true;
    const ro = cleanOrcid(r.o);
    if (orcidKey && ro && ro === orcidKey) return true;
    if (orcidKey && (r.o || '').trim() === key) return true;
    return false;
  });
}

export function isOpenAlexAuthorId(profileId: string): boolean {
  return /^A\d+$/i.test(profileId.trim());
}

export function getResearcherProfilePath(researcher: Researcher): string {
  const orcid = cleanOrcid(researcher.o);
  if (orcid) return `/perfiles/${orcid}`;
  if (researcher.id?.trim()) return `/perfiles/${encodeURIComponent(researcher.id.trim())}`;
  return '/perfiles';
}

/** Solo sincronizar URL de ficha cuando el usuario ya está en Perfiles. */
export function shouldSyncProfileRoute(pathname: string): boolean {
  return pathname === '/perfiles' || pathname.startsWith('/perfiles/');
}

export function getOpenAlexAuthorProfilePath(author: OpenAlexAuthorSummary): string {
  if (author.orcid?.trim()) return `/perfiles/${author.orcid}`;
  if (author.openAlexId) return `/perfiles/${author.openAlexId}`;
  return `/perfiles/${encodeURIComponent(author.id)}`;
}
