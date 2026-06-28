// ═══════════════════════════════════════
// Data Models — Universidad de Tarapacá
// ═══════════════════════════════════════

import type { GlobalProfile } from './globalProfile';

export type { GlobalProfile } from './globalProfile';

// ─── Researcher (from data.json) ───
export interface Department {
  d: string;       // department name
  j?: string;      // job title / position
}

export interface Researcher {
  id?: string;
  f: string;
  l: string;
  t?: string;
  g?: string;        // grado académico (ej. "Doctor en Biología")
  e?: string;
  o?: string;
  ph?: string;
  dp?: Department[];
}

// ─── Works / Publications ───
/** Vínculo autor UTA confirmado vía ORCID→author.id (OpenAlex) */
export interface UtaAuthorLink {
  /** OpenAlex author id normalizado (A…) */
  author_id: string;
  orcid: string;
  rut: string;
  /** display_name exacto del authorship al vincular */
  name: string;
  author_index: number;
}

export interface Work {
  t?: string;      // title (may contain HTML)
  y?: number;      // year
  c?: number;      // citation count
  s?: string;      // source / journal
  tp?: string;     // type (article, book-chapter, etc.)
  oa?: boolean;    // open access
  ou?: string;     // open access URL
  d?: string;      // DOI
  u?: string;      // URL
  a?: string[];    // authors
  topic?: string;
  field?: string;
  subfield?: string;
  sdgs?: string[];
  qi?: string;     // quartile indicator (Q1, Q2, etc.)
  qc?: string;     // quartile color
  impact?: number; // OpenAlex work.fwci (field-weighted citation impact)
  /** Alias explícito de OpenAlex fwci; si presente, tiene prioridad sobre impact */
  fwci?: number | null;
  pub?: string;    // publisher
  srcOA?: boolean; // source is OA journal
  cr_pub?: string; // crossref publisher
  /** Estado OA según Pure/update (ej. 'closed') */
  up_oa_status?: string;
  /** Año según Pure (fallback de y) */
  up_year?: number;
  /** ISSN(s) Crossref — array */
  cr_issn?: string[];
  /** ISSN(s) Pure — string CSV (ej. '2352-409X,2352-4103') */
  up_issn?: string;
  /** Vínculos UTA confirmados por ORCID en authorships OpenAlex */
  autores_uta?: UtaAuthorLink[];
  /** Authorships estilo OpenAlex (si vienen enriquecidas en all-works.json) */
  authorships?: Array<{
    author?: { id?: string; display_name?: string; orcid?: string };
    institutions?: Array<{
      id?: string;
      display_name?: string;
      country_code?: string;
      ror?: string;
      type?: string;
    }>;
    countries?: string[];
  }>;
  /** Percentil de citas normalizado (OpenAlex citation_normalized_percentile) */
  percentile?: {
    value?: number;
    is_in_top_1_percent?: boolean;
    is_in_top_10_percent?: boolean;
  };
  /** Marca de enriquecimiento colaboración (affiliations + percentile) */
  collabFetchedAt?: string;
  /** Alias / campos OpenAlex enriquecidos */
  title?: string;
  cited_by_count?: number;
  doi?: string;
  doi_url?: string;
  url?: string;
  pdf_url?: string;
  openalex_id?: string;
  open_access?: { oa_url?: string; is_oa?: boolean };
  primary_location?: { pdf_url?: string; landing_page_url?: string };
  /** Metadatos bibliográficos opcionales */
  vol?: string | number;
  volume?: string | number;
  issue?: string | number;
  num?: string | number;
  pages?: string;
  /** Citas pre-indexadas (runtime o embebidas) */
  citations?: WorkCitations;
}

export interface WorkCitations {
  apa: string;
  ieee: string;
  vancouver: string;
  bibtex: string;
  ris: string;
  incomplete?: boolean;
}

export interface WorkCitationIndexEntry extends WorkCitations {
  doi?: string;
  updatedAt: string;
}

export type WorkCitationIndex = Record<string, WorkCitationIndexEntry>;

// ─── Datasets (from datasets.json) ───
export interface DatasetRecord {
  openalex_id: string;
  doi: string | null;
  title: string;
  year: number | undefined;
  authors: string[];
  /** Repositorio — primary_location.source.display_name (OpenAlex) */
  repo: string | null;
  /** true solo si open_access.is_oa o primary_location.is_oa === true */
  is_oa: boolean;
  /** landing_page_url o DOI normalizado */
  access_url: string | null;
  citas: number;
  license: string | null;
  /** @deprecated usar repo */
  repository?: string | null;
  /** @deprecated usar access_url */
  landing_page_url?: string | null;
  /** @deprecated usar citas */
  cited_by_count?: number;
}

// ─── OpenAlex Author Profile ───
export interface AuthorOA {
  works_count: number;
  cited_by_count: number;
  h_index: number;
  works?: Work[];
}

// ─── OpenAlex Institution ───
export interface InstitutionOA {
  works_count?: number;
  cited_by_count?: number;
  h_index?: number;
  sdgs?: Array<{ name: string; count: number }>;
}

// ─── OpenAlex Root ───
export interface OpenAlexData {
  institution?: InstitutionOA;
  authors?: Record<string, AuthorOA>;
  sdg_researchers?: Record<string, string[]>;
}

// ─── ORCID ───
export interface CoAuthorRef {
  name: string;
  orcid?: string;
  /** OpenAlex author URL o A-id (presente en orcid-data cuando no hay ORCID) */
  oaId?: string;
  count: number;
  fields?: string[];
  h_index?: number;
  institutions?: string[];
}

export interface Education {
  degree?: string;
  institution?: string;
  department?: string;
  title?: string;
  startYear?: string | number;
  endYear?: string | number;
}

export interface OrcidProfile {
  coAuthors?: CoAuthorRef[];
  education?: Education[];
}

export interface OrcidData {
  profiles?: Record<string, OrcidProfile>;
}

export type ResearcherMetricsScope = 'local_profile' | 'collaboration' | 'global_openalex';

export interface GlobalOpenAlexMetrics {
  works_count?: number;
  cited_by_count?: number;
  h_index?: number;
}

// ─── Co-Author Full Profile ───
export interface CoAuthorProfile {
  name: string;
  orcid?: string;
  oaId?: string;
  institutions?: string[];
  works_count?: number;
  cited_by_count?: number;
  h_index?: number;
  fields?: string[];
  topics?: Array<{ name: string }>;
  works?: Work[];
  /** Ámbito de las métricas mostradas en cabecera y listado */
  metricsScope?: ResearcherMetricsScope;
  /** Totales globales OpenAlex (no mezclar con producción UTA) */
  global_openalex?: GlobalOpenAlexMetrics;
  /** Ámbito del listado de publicaciones (puede diferir de metricsScope si hay fallback) */
  publicationListScope?: ResearcherMetricsScope;
  /** Perfil global de carrera (OpenAlex), pre-cacheado por enrich-coauthor-global */
  global_profile?: GlobalProfile;
}

// ─── AI Data ───
export interface AIData {
  summaries?: Record<string, string>;
  affinity?: Record<string, Array<{ name: string; orcid: string; score: number }>>;
  gaps?: {
    fortalezas?: string[];
    oportunidades?: string[];
    ods_potencial?: string[];
    recomendacion?: string;
  };
}

// ─── Researcher Metrics ───
export interface QuartileProfile {
  q1?: number;
  q2?: number;
  q3?: number;
  q4?: number;
  q1_pct?: number;
  q1q2_pct?: number;
  with_quartile?: number;
}

export interface MetricsQuality {
  above_world_avg?: boolean;
  highly_cited?: boolean;
  interdisciplinary?: boolean;
  productive?: boolean;
}

export interface CareerSpan {
  first?: number;
  last?: number;
  years?: number;
}

export interface ResearcherMetric {
  fwci?: number;
  h_index?: number;
  scholarly_output?: number;
  citation_count?: number;
  oa_rate?: number;
  cited_pct?: number;
  fwci_valid_works?: number;
  works_source?: string;
  field_count?: number;
  fields?: string[];
  sdgs?: string[];
  quartile_profile?: QuartileProfile;
  metrics_quality?: MetricsQuality;
  career_span?: CareerSpan;
  productivity_trend?: Record<string, number>;
}

// ─── Institutional Metrics ───
export interface DistributionStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  p75: number;
}

export interface TrendYear {
  year: number;
  output: number;
  cpp: number;
  oa_pct: number;
  q1_pct: number;
}

export interface FieldDistribution {
  field: string;
  output: number;
  cpp: number;
}

export interface InstitutionalMetrics {
  scholarly_output?: number;
  citation_count?: number;
  citations_per_publication?: number;
  fwci?: number;
  h_index?: number;
  trends?: TrendYear[];
  field_distribution?: FieldDistribution[];
  open_access?: Record<string, { count: number; pct: number }>;
  rankings?: {
    by_h_index?: Array<{ name: string; h_index: number }>;
    by_fwci?: Array<{ name: string; fwci: number }>;
    by_q1_pct?: Array<{ name: string; q1_pct: number }>;
  };
  researcher_distributions?: {
    h_index?: DistributionStats;
    fwci?: DistributionStats;
    citations_per_pub?: DistributionStats;
    scholarly_output?: DistributionStats;
    oa_rate?: DistributionStats;
    q1_pct?: DistributionStats;
  };
  sdg_alignment?: Array<{ sdg: string; publications: number }>;
  crossref_enrichment?: {
    with_funder?: number;
    with_license?: number;
    top_funders?: Array<{ name: string; count: number }>;
  };
  top_journal_percentiles?: { q1_pct?: number };
  top_citation_percentiles?: {
    top1pct?: number; top1?: number;
    top5pct?: number; top5?: number;
    top10pct?: number; top10?: number;
    top25pct?: number; top25?: number;
  };
  collaboration?: Record<string, unknown>;
  publication_types?: Array<{ type: string; count: number }>;
  metadata?: { total_researchers?: number };
}

// ─── Context State Types ───
export type TabKey = 'perfiles' | 'unidades' | 'areas' | 'ods' | 'produccion' | 'descubridor' | 'ranking' | 'metricas' | 'informes' | 'fuentes';
export type SearchType = 'concepto' | 'texto';
export type RankKey = 'fwci' | 'hindex' | 'citas' | 'q1' | 'cpp' | 'oa';
export type AITabKey = 'chat' | 'comparar' | 'redes' | 'tendencias' | 'oportunidades';
export type MetricKey = 'h_index' | 'fwci' | 'cpp' | 'output' | 'cites' | 'oa_rate' | 'datasets';

export interface ChatMessage {
  r: 'user' | 'ai';
  t: string;
}

// ─── UI Context ───
export interface UIState {
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  search: string;
  setSearch: (s: string) => void;
  searchType: SearchType;
  setSearchType: (t: SearchType) => void;
  page: number;
  setPage: (p: number) => void;
  resetPage: () => void;
  // Modals
  selected: Researcher | null;
  openResearcher: (r: Researcher) => void;
  openAlexAuthorId: string | null;
  openOpenAlexResearcher: (authorIdOrUrl: string) => void;
  resolveResearcherProfile: (profileId: string) => void;
  closeResearcher: () => void;
  modalTopic: string;
  setModalTopic: (t: string) => void;
  viewCoAuthor: CoAuthorProfile | null;
  setViewCoAuthor: (c: CoAuthorProfile | null) => void;
  metricDetail: MetricKey | null;
  setMetricDetail: (m: MetricKey | null) => void;
  reportText: string;
  setReportText: (t: string) => void;
  reportLoading: boolean;
  setReportLoading: (l: boolean) => void;
  // AI
  aiTab: AITabKey;
  setAiTab: (t: AITabKey) => void;
  chatMsgs: ChatMessage[];
  setChatMsgs: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  chatIn: string;
  setChatIn: (s: string) => void;
  chatLoading: boolean;
  setChatLoading: (l: boolean) => void;
  comp1: Researcher | null;
  setComp1: (r: Researcher | null) => void;
  comp2: Researcher | null;
  setComp2: (r: Researcher | null) => void;
  compQ: string;
  setCompQ: (s: string) => void;
  // Navigation helpers
  goPerfiles: () => void;
  goOrcid: () => void;
}

// ─── Filters Context ───
export interface FiltersState {
  dept: string;
  setDept: (d: string) => void;
  onlyOrcid: boolean;
  setOnlyOrcid: (o: boolean) => void;
  sdgFilter: string;
  setSdgFilter: (s: string) => void;
  areaFilter: string;
  setAreaFilter: (a: string) => void;
  rankBy: RankKey;
  setRankBy: (r: RankKey) => void;
  // Work filters
  workSearch: string;
  setWorkSearch: (s: string) => void;
  workYear: string;
  setWorkYear: (y: string) => void;
  workType: string;
  setWorkType: (t: string) => void;
  workOA: boolean;
  setWorkOA: (o: boolean) => void;
  workField: string;
  setWorkField: (f: string) => void;
  workSdg: string;
  setWorkSdg: (s: string) => void;
  workPage: number;
  setWorkPage: (p: number) => void;
  cSearch: string;
  setCSearch: (s: string) => void;
  // Computed
  filtered: Researcher[];
  totalPages: number;
  pageData: Researcher[];
}

// ─── Data Context (read-only) ───
export interface DataState {
  DATA: Researcher[];
  INST: InstitutionOA;
  DEPTS: string[];
  deptCounts: Record<string, number>;
}
