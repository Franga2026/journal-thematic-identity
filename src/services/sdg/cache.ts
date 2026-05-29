import type { SdgRankedResearcher, SdgRegionScope } from '../../shared/types/sdgResearcher';
import type { SdgEmptyReason } from './sdgRankingDiagnostics';

interface CacheEntry {
  expiresAt: number;
  rows: SdgRankedResearcher[];
  meta: {
    totalWorksFetched: number;
    diagnostics: string[];
    emptyReason?: SdgEmptyReason;
    emptyMessage?: string;
  };
}

const memoryCache = new Map<string, CacheEntry>();

function cacheKey(sdgId: number, scope: SdgRegionScope): string {
  return `${sdgId}:${scope}`;
}

export function getCachedRanking(
  sdgId: number,
  scope: SdgRegionScope,
  ttlMs: number
): CacheEntry | null {
  const key = cacheKey(sdgId, scope);
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return hit;
}

export function setCachedRanking(
  sdgId: number,
  scope: SdgRegionScope,
  rows: SdgRankedResearcher[],
  meta: CacheEntry['meta'],
  ttlMs: number
): void {
  // No cachear rankings vacíos (evita “Sin resultados” pegajoso tras un fallo transitorio)
  if (rows.length === 0) return;
  memoryCache.set(cacheKey(sdgId, scope), {
    rows,
    meta,
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearSdgRankingCache(): void {
  memoryCache.clear();
}
