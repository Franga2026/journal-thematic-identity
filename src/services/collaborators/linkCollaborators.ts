import type { Researcher, Work } from '../../shared/types';
import type { CoAuthorProfile } from '../../shared/types';
import {
  getAW,
  getCoAuthorProfile,
  getData,
  getOA,
  linkAutoresUta,
  updateAW,
} from '../../utils/dataProcessing';
import { cleanOrcid, getResearcherUtaId, normalizeAuthorName } from '../../utils/helpers';
import { isUTAInstitution } from '../../utils/institutionMatch';
import { getPublicationAuthorships } from '../../utils/publicationAuthorships';
import {
  collectCollaborationWorksForCoAuthor,
  resolveCoAuthorProfile,
  workIncludesCoAuthor,
  type CoAuthorMatchInput,
} from '../../utils/researcherMetrics';
import { fetchAuthorWorkDois, normCollaboratorDoi } from './openAlexCollaboratorWorks';
import type { LinkCollaboratorInput, LinkCollaboratorResult } from './types';

type LinkIndex = {
  orcidToUtaId: Map<string, string>;
  nameToUtaId: Map<string, string>;
  utaIdToOrcid: Map<string, string>;
};

function buildLinkIndex(researchers: Researcher[]): LinkIndex {
  const orcidToUtaId = new Map<string, string>();
  const nameToUtaId = new Map<string, string>();
  const utaIdToOrcid = new Map<string, string>();

  researchers.forEach((r) => {
    const utaId = getResearcherUtaId(r);
    if (!utaId) return;
    const full = normalizeAuthorName(`${r.f || ''} ${r.l || ''}`);
    if (full) nameToUtaId.set(full, utaId);
    const orcid = cleanOrcid(r.o);
    if (orcid) {
      orcidToUtaId.set(orcid, utaId);
      utaIdToOrcid.set(utaId, orcid);
    }
  });

  return { orcidToUtaId, nameToUtaId, utaIdToOrcid };
}

function addResearcherIds(ids: Set<string>, utaId: string | undefined, index: LinkIndex): void {
  if (!utaId) return;
  ids.add(utaId);
  const orcid = index.utaIdToOrcid.get(utaId);
  if (orcid) ids.add(orcid);
}

function utaIdsOnWork(work: Work, index: LinkIndex): Set<string> {
  const ids = new Set<string>(work.autores_uta || []);

  getPublicationAuthorships(work).forEach((raw) => {
    const a = raw as {
      author?: { display_name?: string; orcid?: string };
      institutions?: Array<{ display_name?: string; country_code?: string }>;
    };
    const orcid = cleanOrcid(a.author?.orcid);
    if (orcid && index.orcidToUtaId.has(orcid)) {
      addResearcherIds(ids, index.orcidToUtaId.get(orcid), index);
    }
    const name = normalizeAuthorName(a.author?.display_name);
    if (name && index.nameToUtaId.has(name)) {
      addResearcherIds(ids, index.nameToUtaId.get(name), index);
    }
    (a.institutions || []).forEach((inst) => {
      if (isUTAInstitution(inst.display_name)) {
        index.orcidToUtaId.forEach((utaId, o) => {
          if (ids.has(o) || ids.has(utaId)) addResearcherIds(ids, utaId, index);
        });
      }
    });
  });

  (work.a || []).forEach((author) => {
    const name = normalizeAuthorName(author);
    if (name && index.nameToUtaId.has(name)) {
      addResearcherIds(ids, index.nameToUtaId.get(name), index);
    }
  });

  return ids;
}

/** Enriquece autores_uta usando authorships (ORCID, nombre, institución UTA). */
export function enrichAutoresUtaFromAuthorships(
  works: Work[],
  researchers: Researcher[]
): number {
  const index = buildLinkIndex(researchers);
  let added = 0;

  works.forEach((work) => {
    const before = new Set(work.autores_uta || []);
    const merged = utaIdsOnWork(work, index);
    const next = [...merged];
    if (next.length > before.size) added += next.length - before.size;
    work.autores_uta = next;
  });

  return added;
}

/** Vincula obras donde aparece el coautor y al menos un investigador UTA en la misma obra. */
export function linkCoAuthorCollaborations(
  works: Work[],
  coAuthor: CoAuthorMatchInput,
  researchers: Researcher[]
): number {
  const index = buildLinkIndex(researchers);
  let linked = 0;

  works.forEach((work) => {
    if (!workIncludesCoAuthor(work, coAuthor)) return;
    const utaIds = utaIdsOnWork(work, index);
    if (!utaIds.size) return;
    const before = work.autores_uta?.length || 0;
    work.autores_uta = [...utaIds];
    if (work.autores_uta.length > before) linked += 1;
  });

  return linked;
}

function matchDoisToLocalWorks(works: Work[], dois: string[]): number {
  const doiSet = new Set(dois.map(normCollaboratorDoi).filter(Boolean));
  if (!doiSet.size) return 0;
  let matched = 0;
  works.forEach((w) => {
    const key = normCollaboratorDoi(w.d);
    if (key && doiSet.has(key)) matched += 1;
  });
  return matched;
}

function resolveCoAuthorInput(input: LinkCollaboratorInput): CoAuthorMatchInput & { orcid?: string } {
  const orcid = cleanOrcid(input.orcid);
  if (orcid) {
    const fromStore = getCoAuthorProfile(orcid);
    return {
      orcid,
      name: input.name || fromStore?.name,
      oaId: input.oaId || fromStore?.oaId,
    };
  }
  return { name: input.name, oaId: input.oaId };
}

/**
 * Pipeline de vinculación:
 * 1. linkAutoresUta (nombre + DOI vía openalex.json)
 * 2. enrichAutoresUtaFromAuthorships (ORCID/nombre en authorships)
 * 3. linkCoAuthorCollaborations (coautor + UTA en misma obra)
 * 4. opcional OpenAlex: cruce DOIs del autor con all-works
 */
export async function linkCollaborator(input: LinkCollaboratorInput = {}): Promise<LinkCollaboratorResult> {
  const DATA = getData();
  const OA = getOA();
  const works = getAW().map((w) => ({ ...w, autores_uta: [...(w.autores_uta || [])] }));

  linkAutoresUta(DATA, works, OA);
  const authorshipLinksAdded = enrichAutoresUtaFromAuthorships(works, DATA);

  const coAuthor = resolveCoAuthorInput(input);
  let coAuthorLinked = 0;
  if (coAuthor.orcid || coAuthor.name || coAuthor.oaId) {
    coAuthorLinked = linkCoAuthorCollaborations(works, coAuthor, DATA);
  }

  let openalexDoisMatched = 0;
  if (input.fetchOpenAlex !== false && (coAuthor.orcid || coAuthor.oaId)) {
    try {
      const dois = await fetchAuthorWorkDois({
        orcid: coAuthor.orcid,
        oaId: coAuthor.oaId,
      });
      openalexDoisMatched = matchDoisToLocalWorks(works, dois);
      if (dois.length > 0) {
        enrichAutoresUtaFromAuthorships(works, DATA);
        if (coAuthor.orcid || coAuthor.name || coAuthor.oaId) {
          coAuthorLinked = linkCoAuthorCollaborations(works, coAuthor, DATA);
        }
      }
    } catch {
      // OpenAlex opcional; continuar con vínculos locales
    }
  }

  updateAW(works);

  const rawProfile = coAuthor.orcid ? getCoAuthorProfile(coAuthor.orcid) : null;
  const profile: CoAuthorProfile | null = rawProfile
    ? resolveCoAuthorProfile(rawProfile)
    : coAuthor.orcid || coAuthor.name
      ? resolveCoAuthorProfile({
          name: coAuthor.name || 'Colaborador',
          orcid: coAuthor.orcid,
          oaId: coAuthor.oaId,
          works: [],
        })
      : null;

  const coauthorLinkedCount = profile
    ? collectCollaborationWorksForCoAuthor(profile).length
    : 0;

  const worksWithAutores = works.filter((w) => (w.autores_uta || []).length > 0).length;

  return {
    ok: true,
    total_works: works.length,
    works_with_autores_uta: worksWithAutores,
    coauthor_linked_count: coauthorLinkedCount,
    authorship_links_added: authorshipLinksAdded,
    openalex_dois_matched: openalexDoisMatched,
    profile,
    message:
      coauthorLinkedCount > 0
        ? `${coauthorLinkedCount} publicación(es) en colaboración UTA indexadas.`
        : coAuthorLinked > 0 || authorshipLinksAdded > 0
          ? 'Vínculos autores_uta actualizados; revise el listado del colaborador.'
          : 'No se encontraron obras locales para vincular. Verifique all-works y authorships.',
  };
}
