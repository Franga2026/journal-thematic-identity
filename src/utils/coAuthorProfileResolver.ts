import type { CoAuthorProfile, CoAuthorRef, Researcher } from '../shared/types';
import {
  getCoAuthorProfile,
  getCoAuthorProfileByOpenAlexId,
  getData,
  resolveCoAuthorProfile,
} from './dataProcessing';
import { cleanOrcid } from './helpers';
import { findResearcherByProfileId } from './researcherProfile';

export type CoAuthorClickTarget =
  | { kind: 'uta'; researcher: Researcher }
  | { kind: 'external'; profile: CoAuthorProfile };

/** Perfil bruto en coauthor-profiles o mínimo desde la referencia ORCID. */
export function lookupCoAuthorRawProfile(ref: CoAuthorRef): CoAuthorProfile | null {
  const orcid = cleanOrcid(ref.orcid);
  if (orcid) {
    const fromOrcid = getCoAuthorProfile(orcid);
    if (fromOrcid) return fromOrcid;
  }
  if (ref.oaId) {
    const fromOa = getCoAuthorProfileByOpenAlexId(ref.oaId);
    if (fromOa) return fromOa;
  }
  const name = (ref.name || '').trim();
  if (!orcid && !ref.oaId && !name) return null;
  return {
    name: name || 'Colaborador',
    orcid: orcid || undefined,
    oaId: ref.oaId,
    fields: ref.fields,
    institutions: ref.institutions,
    works: [],
  };
}

export function resolveCoAuthorFromRef(ref: CoAuthorRef): CoAuthorProfile | null {
  const raw = lookupCoAuthorRawProfile(ref);
  if (!raw) return null;
  return resolveCoAuthorProfile(raw);
}

export function getCoAuthorClickTarget(
  ref: CoAuthorRef,
  catalog: Researcher[] = getData()
): CoAuthorClickTarget | null {
  const orcid = cleanOrcid(ref.orcid);
  if (orcid) {
    const local = findResearcherByProfileId(catalog, orcid);
    if (local) return { kind: 'uta', researcher: local };
  }
  const profile = resolveCoAuthorFromRef(ref);
  if (profile) return { kind: 'external', profile };
  return null;
}

/** Comprobación ligera para estilos/listados (no recorre all-works). */
export function isCoAuthorClickable(ref: CoAuthorRef, catalog: Researcher[] = getData()): boolean {
  const orcid = cleanOrcid(ref.orcid);
  if (orcid && findResearcherByProfileId(catalog, orcid)) return true;
  return lookupCoAuthorRawProfile(ref) !== null;
}
