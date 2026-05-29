export interface OpenAlexWorkAuthorship {
  author?: {
    id?: string;
    display_name?: string;
    orcid?: string | null;
  };
  institutions?: Array<{
    id?: string;
    display_name?: string;
    country_code?: string | null;
  }>;
  countries?: string[];
}

export interface OpenAlexWorkResult {
  id: string;
  cited_by_count?: number;
  authorships?: OpenAlexWorkAuthorship[];
}

export interface OpenAlexWorksPage {
  results?: OpenAlexWorkResult[];
  meta?: {
    count?: number;
    per_page?: number;
    page?: number;
    next_cursor?: string | null;
  };
}
