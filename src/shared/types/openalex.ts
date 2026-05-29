/** Resumen de autor (desde /authors o group_by en /works) */
export interface OpenAlexAuthorSummary {
  id: string;
  openAlexId: string;
  display_name: string;
  /** ORCID limpio (0000-0000-0000-0000) */
  orcid?: string;
  cited_by_count: number;
  works_count: number;
  h_index?: number;
  institution?: string;
  country_code?: string;
}

/** Fila de group_by=author.id en /works */
export interface OpenAlexWorksGroupByRow {
  key: string;
  key_display_name: string;
  count: number;
}

export interface OpenAlexWorksGroupByResponse {
  group_by?: OpenAlexWorksGroupByRow[];
}

/** Detalle ampliado para ficha externa */
export interface OpenAlexAuthorDetail extends OpenAlexAuthorSummary {
  orcid?: string;
  topics?: string[];
}

export interface OpenAlexAuthorsResponse {
  results: Array<{
    id: string;
    display_name: string;
    cited_by_count?: number;
    works_count?: number;
    orcid?: string;
    summary_stats?: { h_index?: number };
    last_known_institutions?: Array<{
      display_name?: string;
      country_code?: string;
    }>;
    x_concepts?: Array<{ display_name?: string }>;
  }>;
}
