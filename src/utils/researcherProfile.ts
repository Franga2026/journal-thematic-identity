import type { Researcher } from '../shared/types';
import type { OpenAlexAuthorSummary } from '../shared/types/openalex';
import { cleanOrcid } from './helpers';
import { getData } from './dataProcessing';
import { parseOpenAlexAuthorId } from './openAlexAuthorId';
import { buildAuthorIdAttributionMaps, type OrcidAuthorIdMapFile, type UtaAuthorAttribution } from './orcidAuthorIdMap';
import orcidAuthorIdMapFile from '../data/orcid-authorid-map.json';

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

/** Ruta de ficha desde id de autores_uta (RUT u ORCID tal cual viene en el bundle). */
export function getProfileRoutePath(profileId: string): string {
  const key = profileId.trim();
  return key ? `/perfiles/${encodeURIComponent(key)}` : '/perfiles';
}

/** Mismo investigador aunque el id sea RUT vs ORCID. */
export function isSameResearcherProfileId(
  profileId: string,
  currentResearcher: Researcher | null | undefined,
  catalog: Researcher[],
): boolean {
  if (!currentResearcher) return false;
  const pid = profileId.trim();
  if (!pid) return false;

  const rut = (currentResearcher.id || '').trim();
  if (rut && pid === rut) return true;

  const orcid = cleanOrcid(currentResearcher.o);
  if (orcid && pid === orcid) return true;

  const current = findResearcherByProfileId(catalog, rut || orcid || '');
  const target = findResearcherByProfileId(catalog, pid);
  return Boolean(current && target && current.id && target.id && current.id === target.id);
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

const ORCID_MAP = (orcidAuthorIdMapFile as OrcidAuthorIdMapFile).map ?? {};

let _reverseByAuthorId: Map<string, UtaAuthorAttribution> | null = null;
let _reverseCatalogSize = 0;

function getUtaReverseByAuthorId(catalog: Researcher[]) {
  if (_reverseByAuthorId && _reverseCatalogSize === catalog.length) {
    return _reverseByAuthorId;
  }
  const { reverseByAuthorId } = buildAuthorIdAttributionMaps(catalog, ORCID_MAP);
  _reverseByAuthorId = reverseByAuthorId;
  _reverseCatalogSize = catalog.length;
  return reverseByAuthorId;
}

/** Resuelve author.id OpenAlex (A…) → investigador UTA vía orcid-authorid-map.json. */
export function findResearcherByOpenAlexAuthorId(
  authorId: string,
  catalog: Researcher[] = getData(),
): Researcher | undefined {
  const parsed = parseOpenAlexAuthorId(authorId);
  if (!parsed) return undefined;

  const reverse = catalog === getData()
    ? getUtaReverseByAuthorId(catalog)
    : buildAuthorIdAttributionMaps(catalog, ORCID_MAP).reverseByAuthorId;

  const attr = reverse.get(parsed);
  if (!attr) return undefined;

  return (
    catalog.find((r) => (r.id || '').trim() === attr.rut)
    ?? findResearcherByProfileId(catalog, attr.orcid)
  );
}

export function isUtaOpenAlexAuthorId(
  authorId: string,
  catalog: Researcher[] = getData(),
): boolean {
  return !!findResearcherByOpenAlexAuthorId(authorId, catalog);
}
