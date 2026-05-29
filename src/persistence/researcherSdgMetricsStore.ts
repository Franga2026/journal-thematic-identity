import type { SdgRankedResearcher, SdgRegionScope } from '../shared/types/sdgResearcher';

/** Contrato para tabla/materialized view `researcher_sdg_metrics` (PostgreSQL/Supabase) */
export interface ResearcherSdgMetricsStore {
  save(sdgId: number, scope: SdgRegionScope, rows: SdgRankedResearcher[]): Promise<void>;
  load(sdgId: number, scope: SdgRegionScope): Promise<SdgRankedResearcher[] | null>;
}

class InMemoryResearcherSdgMetricsStore implements ResearcherSdgMetricsStore {
  private readonly data = new Map<string, SdgRankedResearcher[]>();

  private key(sdgId: number, scope: SdgRegionScope): string {
    return `${sdgId}:${scope}`;
  }

  async save(sdgId: number, scope: SdgRegionScope, rows: SdgRankedResearcher[]): Promise<void> {
    this.data.set(this.key(sdgId, scope), rows);
  }

  async load(sdgId: number, scope: SdgRegionScope): Promise<SdgRankedResearcher[] | null> {
    return this.data.get(this.key(sdgId, scope)) ?? null;
  }
}

export const memoryResearcherSdgMetricsStore: ResearcherSdgMetricsStore =
  new InMemoryResearcherSdgMetricsStore();

/**
 * Punto de extensión: reemplazar por implementación Supabase/PostgreSQL.
 * export class PostgresResearcherSdgMetricsStore implements ResearcherSdgMetricsStore { ... }
 */
