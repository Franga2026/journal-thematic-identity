import type { GlobalProfile } from './globalProfile';
import type { Work } from './index';

/** Ámbito geográfico del ranking ODS */
export type SdgRegionScope = 'local' | 'iberoamerica' | 'global';

/** Coautor frecuente en obras ODS (JSON v2 build-ods-rankings) */
export interface SdgTopCoauthor {
  name: string;
  openalex_id?: string;
  institution?: string | null;
  country?: string | null;
  works_together: number;
}

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
  /** Obras ODS en shape Work (JSON v2 / enrich offline) */
  works?: Work[];
  /** Perfil de carrera OpenAlex (JSON v2) */
  global_profile?: GlobalProfile;
  /** Top coautores en obras ODS (JSON v2; UI pendiente) */
  top_coauthors?: SdgTopCoauthor[];
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
