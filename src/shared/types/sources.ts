export type CoverageDepth = 'fulltext' | 'ebook' | 'indexed' | 'abstracts' | 'print';
export type ResourceType = 'journal' | 'ebook' | 'serial';

export interface CollectionStat {
  collection_name: string;
  records: number;
  depths: Record<string, number>;
  date_range: [number | null, number | null];
}

export interface KBStats {
  total_raw_records: number;
  total_unique_sources: number;
  dedup_merges: number;
  dedup_rate: number;
  journals: number;
  ebooks: number;
  fulltext_access: number;
  indexed_only: number;
  open_access: number;
  multi_collection: number;
  top_publishers: [string, number][];
  collections: CollectionStat[];
}

export interface CoverageGap {
  total_gap: number;
  gap_pct: number;
  gap_by_publisher: [string, number][];
}

export interface CollectionOverlap {
  collection_a: string;
  collection_b: string;
  shared_sources: number;
  pct_of_a: number;
  pct_of_b: number;
}

export interface KBData {
  stats: KBStats;
  coverage_gap: CoverageGap;
  collection_overlap: { overlaps: CollectionOverlap[] };
}
