export type DataCiteUsage = {
  viewCount: number;
  downloadCount: number;
  citationCount: number;
};

const cache = new Map<string, DataCiteUsage | null>();

/** Normaliza un DOI: quita prefijo doi.org, recorta y baja a minúsculas. */
export function normalizeDoi(rawDoi: string | null | undefined): string {
  if (!rawDoi) return '';
  return rawDoi
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .trim()
    .toLowerCase();
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Limpia el caché (tests o refresco manual). */
export function clearDataCiteUsageCache(): void {
  cache.clear();
}

/**
 * Métricas de uso (Make Data Count) de un dataset vía DataCite.
 * Devuelve null si: no hay DOI, no hay registro (404) o error de red.
 * Cachea resultados exitosos y 404. Los errores de red NO se cachean (reintento).
 */
export async function fetchDataCiteUsage(rawDoi: string): Promise<DataCiteUsage | null> {
  const doi = normalizeDoi(rawDoi);
  if (!doi) return null;
  if (cache.has(doi)) return cache.get(doi) ?? null;

  try {
    const res = await fetch(`https://api.datacite.org/dois/${doi}`);
    if (res.status === 404) {
      cache.set(doi, null);
      return null;
    }
    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    const a = json?.data?.attributes ?? {};
    const usage: DataCiteUsage = {
      viewCount: num(a.viewCount),
      downloadCount: num(a.downloadCount),
      citationCount: num(a.citationCount),
    };
    cache.set(doi, usage);
    return usage;
  } catch {
    return null;
  }
}
