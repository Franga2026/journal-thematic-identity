import anidLinkage from '../data/anid-linkage.json';
import type { Researcher } from '../shared/types';
import { cleanOrcid } from './helpers';

type AnidLinkageEntry = {
  anid_id: string;
  orcid?: string;
  rut?: string;
  uta_name?: string;
  anid_name?: string;
};

const entries = (anidLinkage as { entries?: AnidLinkageEntry[] }).entries ?? [];

const byOrcid = new Map<string, AnidLinkageEntry>();
const byRut = new Map<string, AnidLinkageEntry>();

for (const entry of entries) {
  const orcid = cleanOrcid(entry.orcid);
  if (orcid) byOrcid.set(orcid.toUpperCase(), entry);
  const rut = (entry.rut || '').trim();
  if (rut) byRut.set(rut, entry);
}

export function getAnidLinkageForResearcher(person: Researcher | null | undefined): AnidLinkageEntry | null {
  if (!person) return null;
  const orcid = cleanOrcid(person.o);
  if (orcid) {
    const hit = byOrcid.get(orcid.toUpperCase());
    if (hit) return hit;
  }
  const rut = (person.id || '').trim();
  if (rut) {
    const hit = byRut.get(rut);
    if (hit) return hit;
  }
  return null;
}

export function getAnidProfileUrl(anidId: string): string {
  return `https://investigadores.anid.cl/es/public_search/researcher?id=${encodeURIComponent(anidId)}`;
}

export function getAnidLinkageStats(): { linked: number } {
  return { linked: entries.length };
}
