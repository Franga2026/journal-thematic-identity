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
import { cleanOrcid, getResearcherUtaId } from '../../utils/helpers';
import type { OrcidAuthorIdMapFile } from '../../utils/orcidAuthorIdMap';
import {
  buildUtaLinksFromAuthorships,
  dedupeUtaLinks,
  getUtaLinks,
} from '../../utils/utaAuthorLinks';
import {
  collectCollaborationWorksForCoAuthor,
  resolveCoAuthorProfile,
  workIncludesCoAuthor,
  type CoAuthorMatchInput,
} from '../../utils/researcherMetrics';
import { fetchAuthorWorkDois, normCollaboratorDoi } from './openAlexCollaboratorWorks';
import type { LinkCollaboratorInput, LinkCollaboratorResult } from './types';

/** Enriquece autores_uta solo por ORCID exacto en authorships. */
export function enrichAutoresUtaFromAuthorships(
  works: Work[],
  researchers: Researcher[],
  mapFile?: OrcidAuthorIdMapFile,
): number {
  let added = 0;

  works.forEach((work) => {
    const authorships = work.authorships;
    if (!Array.isArray(authorships) || !authorships.length) return;

    const before = getUtaLinks(work).length;
    const links = buildUtaLinksFromAuthorships(work, researchers, mapFile);
    work.autores_uta = links;
    if (links.length > before) added += links.length - before;
  });

  return added;
}

/** Vincula obras donde aparece el coautor y al menos un investigador UTA en la misma obra. */
export function linkCoAuthorCollaborations(
  works: Work[],
  coAuthor: CoAuthorMatchInput,
  researchers: Researcher[]
): number {
  let linked = 0;

  works.forEach((work) => {
    if (!workIncludesCoAuthor(work, coAuthor)) return;
    const links = buildUtaLinksFromAuthorships(work, researchers);
    if (!links.length) return;
    const before = getUtaLinks(work).length;
    work.autores_uta = dedupeUtaLinks([...getUtaLinks(work), ...links]);
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

  linkAutoresUta(DATA, works);
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

  const worksWithAutores = works.filter((w) => getUtaLinks(w).length > 0).length;

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
