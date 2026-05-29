import type { Researcher, Work } from '../../shared/types';
import { cleanOrcid, getResearcherUtaId, normalizeAuthorName } from '../../utils/helpers';
import { getPublicationAuthorships } from '../../utils/publicationAuthorships';
import type { SdgRankingDiagnostics } from './sdgRankingDiagnostics';

export interface LocalExtractedAuthorship {
  authorKey: string;
  authorName: string;
  orcid?: string;
  institutionName?: string;
  institutionOpenalexId?: string;
  countryCodes: string[];
  isUtaLinked: boolean;
  utaResearcherId?: string;
}

function slugAuthorKey(name: string): string {
  const norm = normalizeAuthorName(name);
  return `name:${norm}`;
}

function parseId(urlOrId: string): string {
  return urlOrId.replace('https://openalex.org/', '').trim();
}

type ResearcherIndex = {
  byId: Map<string, Researcher>;
  byName: Map<string, Researcher>;
};

export function buildResearcherIndex(researchers: Researcher[]): ResearcherIndex {
  const byId = new Map<string, Researcher>();
  const byName = new Map<string, Researcher>();

  researchers.forEach((r) => {
    const utaId = getResearcherUtaId(r);
    if (utaId) byId.set(utaId, r);
    if (r.id?.trim()) byId.set(r.id.trim(), r);
    const orcid = cleanOrcid(r.o);
    if (orcid) byId.set(orcid, r);
    const full = normalizeAuthorName(`${r.f || ''} ${r.l || ''}`);
    if (full) byName.set(full, r);
  });

  return { byId, byName };
}

function pushAuthorship(
  list: LocalExtractedAuthorship[],
  seen: Set<string>,
  entry: LocalExtractedAuthorship
): void {
  if (seen.has(entry.authorKey)) return;
  seen.add(entry.authorKey);
  list.push(entry);
}

/** Extrae autorías de una obra local: authorships → autores_uta → a[] */
export function extractAuthorshipsFromWork(
  work: Work,
  index: ResearcherIndex
): LocalExtractedAuthorship[] {
  const list: LocalExtractedAuthorship[] = [];
  const seen = new Set<string>();

  const rawAuthorships = getPublicationAuthorships(work);

  if (rawAuthorships.length > 0) {
    rawAuthorships.forEach((raw) => {
      const a = raw as {
        author?: { id?: string; display_name?: string; orcid?: string };
        institutions?: Array<{ id?: string; display_name?: string; country_code?: string }>;
        countries?: string[];
      };
      const authorRef = a.author;
      const name = authorRef?.display_name?.trim();
      if (!name && !authorRef?.id) return;

      const authorKey = authorRef?.id ? parseId(authorRef.id) : slugAuthorKey(name || 'unknown');
      const countries = new Set<string>();
      (a.countries || []).forEach((c) => c && countries.add(c.toUpperCase()));
      (a.institutions || []).forEach((inst) => {
        if (inst.country_code) countries.add(inst.country_code.toUpperCase());
      });

      const orcid = authorRef?.orcid?.replace('https://orcid.org/', '');
      const linked = orcid ? index.byId.get(orcid) : undefined;
      const inst0 = a.institutions?.[0];

      pushAuthorship(list, seen, {
        authorKey,
        authorName: name || 'Sin nombre',
        orcid,
        institutionName: inst0?.display_name,
        institutionOpenalexId: inst0?.id ? parseId(inst0.id) : undefined,
        countryCodes: [...countries],
        isUtaLinked: Boolean(linked),
        utaResearcherId: linked ? getResearcherUtaId(linked) : undefined,
      });
    });
  }

  (work.autores_uta || []).forEach((rawId) => {
    const id = rawId.trim();
    if (!id) return;
    const researcher = index.byId.get(id);
    if (!researcher) return;
    const authorKey = getResearcherUtaId(researcher) || id;
    pushAuthorship(list, seen, {
      authorKey,
      authorName: `${researcher.f || ''} ${researcher.l || ''}`.trim(),
      orcid: cleanOrcid(researcher.o) || undefined,
      institutionName: (researcher.dp || [])[0]?.d || 'Universidad de Tarapacá',
      countryCodes: ['CL'],
      isUtaLinked: true,
      utaResearcherId: getResearcherUtaId(researcher) || researcher.id,
    });
  });

  (work.a || []).forEach((authorName) => {
    const name = (authorName || '').trim();
    if (!name) return;
    const norm = normalizeAuthorName(name);
    const researcher = index.byName.get(norm);
    const authorKey = researcher
      ? getResearcherUtaId(researcher) || slugAuthorKey(name)
      : slugAuthorKey(name);

    pushAuthorship(list, seen, {
      authorKey,
      authorName: researcher ? `${researcher.f || ''} ${researcher.l || ''}`.trim() : name,
      orcid: researcher ? cleanOrcid(researcher.o) || undefined : undefined,
      institutionName: researcher
        ? (researcher.dp || [])[0]?.d || 'Universidad de Tarapacá'
        : undefined,
      countryCodes: researcher ? ['CL'] : [],
      isUtaLinked: Boolean(researcher),
      utaResearcherId: researcher ? getResearcherUtaId(researcher) || researcher.id : undefined,
    });
  });

  return list;
}

export function scanLocalWorksAuthorships(
  works: Work[],
  index: ResearcherIndex,
  diag?: SdgRankingDiagnostics
): LocalExtractedAuthorship[][] {
  return works.map((work, i) => {
    const rawAuthorships = (work as Work & { authorships?: unknown[] }).authorships;
    if (Array.isArray(rawAuthorships) && rawAuthorships.length) diag && (diag.worksWithAuthorships += 1);
    if ((work.a || []).length) diag && (diag.worksWithAuthorsArray += 1);
    if ((work.autores_uta || []).length) diag && (diag.worksWithAutoresUta += 1);
    if (i === 0) diag && (diag.samplePublication = work);
    return extractAuthorshipsFromWork(work, index);
  });
}
