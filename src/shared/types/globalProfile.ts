export interface GlobalProfile {
  source: string;
  fetched_at: string;
  author_id: string;
  home_country: string | null;
  works_count: number;
  cited_by_count: number;
  h_index: number | null;
  i10_index: number | null;
  fwci_mean: number | null;
  elite: {
    total: number;
    top10: number;
    top1: number;
    pct10: number;
    pct1: number;
  };
  oa: {
    pct: number;
    segments: {
      key: string;
      label: string;
      color: string;
      count: number;
      pct: number;
    }[];
  };
  scope: {
    intl: number;
    natl: number;
    inst: number;
    total: number;
  };
  cuartiles: {
    Q1: number;
    Q2: number;
    Q3: number;
    Q4: number;
    with_quartile: number;
  } | null;
  trajectory: { year: number; works: number; cum_cits: number }[];
  top_works: {
    title: string;
    year: number;
    cited: number;
    fwci: number | null;
    journal: string | null;
    doi: string;
    oa_status: string | null;
  }[];
}
