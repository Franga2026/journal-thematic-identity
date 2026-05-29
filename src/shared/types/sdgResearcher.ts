/** Ámbito geográfico del ranking ODS */
export type SdgRegionScope = 'local' | 'iberoamerica' | 'global';

/** Fila de ranking bibliométrico por ODS (contrato UI + persistencia futura) */
export interface SdgRankedResearcher {
  id: string;
  sdg_id: number;
  author_openalex_id: string;
  author_name: string;
  orcid?: string;
  institution_name?: string;
  institution_openalex_id?: string;
  country_code?: string;
  region_scope: SdgRegionScope;
  publications_count: number;
  citations_count: number;
  h_index_sdg: number;
  collaboration_score: number;
  score: number;
  rank: number;
  last_updated: string;
  /** ID UTA (RUT/ORCID) cuando region_scope === 'local' */
  uta_researcher_id?: string;
}

export type SdgEmptyReason =
  | 'ok'
  | 'no_publications'
  | 'no_authorships'
  | 'authors_filtered_out'
  | 'openalex_fallback_failed';

export interface SdgResearchersApiResponse {
  sdg_id: number;
  sdg_name: string;
  region_scope: SdgRegionScope;
  total_works_fetched: number;
  researchers: SdgRankedResearcher[];
  cached: boolean;
  empty_reason?: SdgEmptyReason;
  empty_message?: string;
  diagnostics?: string[];
}
