// ═══════════════════════════════════════
// Data Models — Universidad de Tarapacá
// ═══════════════════════════════════════

// ─── Researcher (from data.json) ───
export interface Department {
  d: string;       // department name
  j?: string;      // job title / position
}

export interface Researcher {
  f: string;       // first name
  l: string;       // last name
  t?: string;      // title / position
  e?: string;      // email
  o?: string;      // ORCID
  ph?: string;     // photo filename
  dp?: Department[];
}

// ─── Works / Publications ───
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
  impact?: number;
  pub?: string;    // publisher
  srcOA?: boolean; // source is OA journal
  cr_pub?: string; // crossref publisher
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
  count: number;
  fields?: string[];
  h_index?: number;
}

export interface Education {
  degree?: string;
  institution: string;
  endYear?: number;
}

export interface OrcidProfile {
  coAuthors?: CoAuthorRef[];
  education?: Education[];
}

export interface OrcidData {
  profiles?: Record<string, OrcidProfile>;
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
export type TabKey = 'perfiles' | 'unidades' | 'areas' | 'ods' | 'produccion' | 'colaboradores' | 'ranking' | 'metricas' | 'ia' | 'informes';
export type SearchType = 'concepto' | 'texto';
export type RankKey = 'fwci' | 'hindex' | 'citas' | 'q1' | 'cpp' | 'oa';
export type AITabKey = 'chat' | 'comparar' | 'redes' | 'tendencias' | 'oportunidades';
export type MetricKey = 'h_index' | 'fwci' | 'cpp' | 'output' | 'cites' | 'oa_rate' | 'q1_pct';

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
  ORCID_COUNT: number;
}
