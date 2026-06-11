import type { CoAuthorProfile, Work } from '../shared/types';
import { approximateHIndex } from '../services/sdg/scoring';
import { cleanOrcid, normalizeAuthorName } from './helpers';
import { getPublicationAuthorships } from './publicationAuthorships';
import { enrichWork, getAW } from './dataProcessing';
import { mergeWorksWithCatalog } from './workAccess';
import { getUtaLinks } from './utaAuthorLinks';

export type ResearcherMetricsScope = 'local_profile' | 'collaboration' | 'global_openalex';

export const METRICS_SCOPE_LABELS: Record<ResearcherMetricsScope, string> = {
  local_profile: 'Métricas del perfil institucional',
  collaboration: 'Métricas de colaboración con UTA',
  global_openalex: 'Métricas globales OpenAlex',
};

export interface GlobalOpenAlexMetrics {
  works_count?: number;
  cited_by_count?: number;
  h_index?: number;
}

export interface BuiltResearcherMetrics {
  authorId?: string;
  name?: string;
  publicationsCount: number;
  citationsCount: number;
  hIndex: number;
  /** Todas las publicaciones del ámbito, ordenadas por citas */
  publications: Work[];
  topPublications: Work[];
  areas: string[];
  metricsScope: ResearcherMetricsScope;
  globalOpenAlex?: GlobalOpenAlexMetrics;
}

export interface BuildResearcherMetricsInput {
  authorId?: string;
  name?: string;
  publications: Work[];
  scope: ResearcherMetricsScope;
  globalOpenAlex?: GlobalOpenAlexMetrics;
  /** Catálogo global (p. ej. obras OpenAlex del coautor) para restaurar URLs */
  catalogWorks?: Work[];
}

function parseOpenAlexAuthorId(oaId?: string): string {
  if (!oaId) return '';
  return oaId.replace('https://openalex.org/', '').trim();
}

function normDoi(d?: string): string {
  const raw = (d || '').toLowerCase().trim();
  if (!raw) return '';
  return raw.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
}

function workDedupeKey(w: Work): string {
  const doi = normDoi(w.d);
  if (doi) return `doi:${doi}`;
  const title = (w.t || '').replace(/<[^>]*>/g, '').toLowerCase().trim();
  return title ? `title:${title}` : `y:${w.y}|${(w.a || []).join('|')}`;
}

export function dedupeWorks(works: Work[]): Work[] {
  const seen = new Set<string>();
  const out: Work[] = [];
  works.forEach((w) => {
    const key = workDedupeKey(w);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(w);
  });
  return out;
}

/** Obra vinculada al directorio UTA (tiene al menos un investigador UTA en autores_uta). */
export function isUtaCollaborationWork(work: Work): boolean {
  return getUtaLinks(work).length > 0;
}

export interface CoAuthorMatchInput {
  name?: string;
  orcid?: string;
  oaId?: string;
}

/** ¿El coautor aparece en esta obra? (ORCID, OpenAlex ID o nombre normalizado). */
export function workIncludesCoAuthor(work: Work, profile: CoAuthorMatchInput): boolean {
  const orcid = cleanOrcid(profile.orcid);
  const oaAuthorId = parseOpenAlexAuthorId(profile.oaId);
  const nameNorm = profile.name ? normalizeAuthorName(profile.name) : '';

  const authorships = getPublicationAuthorships(work);
  if (authorships.length > 0) {
    for (const raw of authorships) {
      const a = raw as {
        author?: { id?: string; display_name?: string; orcid?: string };
      };
      const ref = a.author;
      if (!ref) continue;
      if (orcid && cleanOrcid(ref.orcid) === orcid) return true;
      if (oaAuthorId && parseOpenAlexAuthorId(ref.id) === oaAuthorId) return true;
      if (nameNorm && ref.display_name && normalizeAuthorName(ref.display_name) === nameNorm) {
        return true;
      }
    }
  }

  if (nameNorm && (work.a || []).some((author) => normalizeAuthorName(author) === nameNorm)) {
    return true;
  }

  return false;
}

/** Publicaciones del repositorio local donde el coautor colabora con investigadores UTA.
 *  Requiere `autores_uta` en all-works.json — ver `coAuthorsTechnicalNote.ts` y `npm run link:works`. */
export function collectCollaborationWorksForCoAuthor(
  profile: CoAuthorMatchInput,
  allWorks: Work[] = getAW()
): Work[] {
  const matched = allWorks.filter(
    (w) => isUtaCollaborationWork(w) && workIncludesCoAuthor(w, profile)
  );
  return dedupeWorks(matched);
}

function aggregateAreas(works: Work[]): string[] {
  const counts = new Map<string, number>();
  works.forEach((w) => {
    const f = w.field || w.topic;
    if (!f) return;
    counts.set(f, (counts.get(f) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f);
}

export function buildResearcherMetrics(input: BuildResearcherMetricsInput): BuiltResearcherMetrics {
  const pubs = dedupeWorks(input.publications || []);
  const citationsPerWork = pubs.map((w) => w.c ?? 0);
  const citationsCount = citationsPerWork.reduce((sum, c) => sum + c, 0);
  const sorted = [...pubs].sort((a, b) => (b.c ?? 0) - (a.c ?? 0));
  const publications = mergeWorksWithCatalog(sorted, input.catalogWorks || []).map(
    (w) => enrichWork(w) as Work
  );
  const topPublications = publications.slice(0, 10);

  return {
    authorId: input.authorId,
    name: input.name,
    publicationsCount: pubs.length,
    citationsCount,
    hIndex: approximateHIndex(citationsPerWork),
    publications,
    topPublications,
    areas: aggregateAreas(pubs),
    metricsScope: input.scope,
    globalOpenAlex: input.globalOpenAlex,
  };
}

/** Perfil de coautor con métricas de colaboración UTA; conserva globales OpenAlex por separado. */
export function resolveCoAuthorProfile(raw: CoAuthorProfile | null): CoAuthorProfile | null {
  if (!raw) return null;

  const collabWorks = collectCollaborationWorksForCoAuthor(raw);
  const catalogWorks = raw.works || [];
  const hasGlobal =
    (raw.works_count ?? 0) > 0 ||
    (raw.cited_by_count ?? 0) > 0 ||
    (raw.h_index ?? 0) > 0;

  const globalOpenAlex: GlobalOpenAlexMetrics | undefined = hasGlobal
    ? {
        works_count: raw.works_count,
        cited_by_count: raw.cited_by_count,
        h_index: raw.h_index,
      }
    : undefined;

  const useGlobalCatalogFallback = collabWorks.length === 0 && catalogWorks.length > 0;
  const listPublications = useGlobalCatalogFallback ? catalogWorks : collabWorks;
  const publicationListScope: ResearcherMetricsScope = useGlobalCatalogFallback
    ? 'global_openalex'
    : 'collaboration';

  const built = buildResearcherMetrics({
    authorId: cleanOrcid(raw.orcid) || parseOpenAlexAuthorId(raw.oaId),
    name: raw.name,
    publications: listPublications,
    scope: useGlobalCatalogFallback ? 'global_openalex' : 'collaboration',
    globalOpenAlex,
    catalogWorks,
  });

  const metricsScope: ResearcherMetricsScope = 'collaboration';
  const headerMetrics = useGlobalCatalogFallback
    ? {
        works_count: 0,
        cited_by_count: 0,
        h_index: 0,
      }
    : {
        works_count: built.publicationsCount,
        cited_by_count: built.citationsCount,
        h_index: built.hIndex,
      };

  return {
    ...raw,
    metricsScope,
    publicationListScope,
    ...headerMetrics,
    fields: built.areas.length ? built.areas : raw.fields,
    works: built.publications,
    global_openalex: built.globalOpenAlex,
  };
}
