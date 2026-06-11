/**
 * openAlexMetrics.ts — Métricas del investigador directo desde OpenAlex.
 *
 * Capa de datos / enriquecimiento (Node o build step). NUNCA llamar desde el navegador:
 * cachea el resultado (JSON / Postgres) y refréscalo por job. La ficha solo lee `oa.fwci` ya calculado.
 *
 * Resuelve directo desde OpenAlex:
 *   - worksCount, citedByCount, hIndex        -> 1 llamada al objeto autor
 *   - citationsPerPub (CPP)                    -> derivado
 *   - fwci (FWCI del investigador)             -> media de work.fwci sobre sus obras
 *   - oaRate (% Open Access)                   -> group_by=open_access.is_oa
 *
 * Metodología FWCI:
 *   - FWCI del autor = media aritmética de los `fwci` por obra (igual que el FWCI de autor en Scopus).
 *   - Se omiten obras con fwci === null (datasets u obras sin estrato calculable).
 *   - Se excluyen obras del año en curso (ventana de citación incompleta; mismo criterio que la tile).
 *   - Las citas absolutas y el conteo de obras sí incluyen el año en curso.
 *   - Se excluye paratext por defecto. `sinceYear` permite un "FWCI reciente".
 *
 * Aviso: el FWCI de OpenAlex tiende a ser MÁS ALTO que el de Scopus/WoS (su base incluye muchas
 * obras sin citas, lo que baja las citas esperadas). No esperes paridad 1:1 con SciVal/InCites.
 *
 * Requiere fetch global (Node >= 18).
 */

import { workJournalIssns } from './scopusIndex.js';
import { fwciIsEligible } from '../shared/metrics/fwci.js';

const OPENALEX = 'https://api.openalex.org';

/* ─── Tipos de respuesta de OpenAlex (parciales: solo lo que leemos) ─── */
interface OpenAlexSummaryStats {
  h_index?: number;
  i10_index?: number;
  '2yr_mean_citedness'?: number;
}
interface OpenAlexAuthor {
  id?: string;
  display_name?: string;
  ids?: { orcid?: string };
  works_count?: number;
  cited_by_count?: number;
  summary_stats?: OpenAlexSummaryStats;
}
interface OpenAlexWorkSource {
  issn?: string[];
  issn_l?: string | null;
}
interface OpenAlexPrimaryLocation {
  source?: OpenAlexWorkSource;
}
interface OpenAlexWork {
  id?: string;
  publication_year?: number;
  type?: string;
  fwci?: number | null;
  primary_location?: OpenAlexPrimaryLocation;
}
interface WorksListResponse {
  results?: OpenAlexWork[];
  meta?: { next_cursor?: string | null };
}
interface GroupByBucket {
  key: string;
  key_display_name?: string;
  count: number;
}
interface GroupByResponse {
  group_by?: GroupByBucket[];
}
interface CountResponse {
  meta?: { count?: number };
}
interface AuthorsListResponse {
  results?: OpenAlexAuthor[];
}

/* ─── Tipos de salida ─── */
export interface AuthorCore {
  authorId: string;
  displayName: string;
  orcid: string;
  worksCount: number;
  citedByCount: number;
  hIndex: number;
  i10Index: number;
  meanCitedness2yr: number; // OJO: NO es FWCI (es tipo factor de impacto)
}
export interface FwciResult {
  fwci: number | null;
  nWorks: number;
  nWithFwci: number;
  fwciByYear?: Record<string, number>;
}
export interface OaRateResult {
  oaRate: number;
  oaWorks: number;
  totalWorks: number;
}
export interface ScopusIndexResult {
  scopusIndexedRate: number | null;
  scopusIndexedN: number;
  scopusWorksTotal: number;
}
export interface AuthorOA extends AuthorCore {
  citationsPerPub: number;
  fwci: number | null; // null => "sin dato" (NO 0)
  fwciN: number; // sobre cuántas obras se promedió
  fwciByYear?: Record<string, number>;
  oaRate: number;
  fetchedAt: string;
  source: 'openalex';
}

export interface FwciOptions {
  sinceYear?: number;
  types?: string[];
  excludeParatext?: boolean;
  byYear?: boolean;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function shortId(id: string | undefined): string {
  if (!id) return '';
  const parts = id.split('/');
  return (parts[parts.length - 1] ?? '').trim();
}

function looksLikeOrcid(value: string): boolean {
  const v = value.replace(/^https?:\/\/orcid\.org\//i, '').trim();
  return v.length === 19 && (v.match(/-/g) ?? []).length === 3;
}

/* ─── Cliente con polite pool (mailto), api_key opcional y reintentos con backoff ─── */
export class OpenAlexClient {
  private readonly mailto: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(opts: { mailto: string; apiKey?: string; timeoutMs?: number }) {
    if (!opts.mailto) throw new Error('Pasa un mailto (polite pool de OpenAlex).');
    this.mailto = opts.mailto;
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  private buildUrl(path: string, params: Record<string, string>): string {
    const search = new URLSearchParams({ mailto: this.mailto, ...params });
    if (this.apiKey) search.set('api_key', this.apiKey);
    return `${OPENALEX}${path}?${search.toString()}`;
  }

  async get<T>(path: string, params: Record<string, string>, maxRetries = 5): Promise<T> {
    const url = this.buildUrl(path, params);
    let lastStatus = 0;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': `directorio-uta/1.0 (mailto:${this.mailto})` },
        });
        lastStatus = res.status;
        if (res.ok) return (await res.json()) as T;
        if ([429, 500, 502, 503, 504].includes(res.status)) {
          await sleep(Math.min(2 ** attempt, 30) * 1000);
          continue;
        }
        throw new Error(`OpenAlex ${res.status} en ${path}`);
      } catch (err) {
        if (attempt === maxRetries - 1) throw err;
        await sleep(Math.min(2 ** attempt, 30) * 1000);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error(`OpenAlex no respondió tras ${maxRetries} intentos (último status ${lastStatus}).`);
  }

  /** Recorre todas las obras de un filtro con cursor pagination. */
  async *iterWorks(filter: string, select: string, perPage = 200): AsyncGenerator<OpenAlexWork> {
    let cursor: string | null = '*';
    while (cursor) {
      const data: WorksListResponse = await this.get<WorksListResponse>('/works', {
        filter,
        select,
        'per-page': String(perPage),
        cursor,
      });
      for (const w of data.results ?? []) yield w;
      cursor = data.meta?.next_cursor ?? null;
    }
  }
}

/** Una sola llamada al objeto autor: worksCount, citedByCount, hIndex, etc. */
export async function getAuthorCore(client: OpenAlexClient, orcidOrId: string): Promise<AuthorCore> {
  const ident = orcidOrId.trim();
  const path = looksLikeOrcid(ident)
    ? `/authors/orcid:${ident.replace(/^https?:\/\/orcid\.org\//i, '').trim()}`
    : `/authors/${shortId(ident)}`;

  const a = await client.get<OpenAlexAuthor>(path, {});
  const ss = a.summary_stats ?? {};
  return {
    authorId: shortId(a.id),
    displayName: a.display_name ?? '',
    orcid: a.ids?.orcid ?? '',
    worksCount: a.works_count ?? 0,
    citedByCount: a.cited_by_count ?? 0,
    hIndex: ss.h_index ?? 0,
    i10Index: ss.i10_index ?? 0,
    meanCitedness2yr: ss['2yr_mean_citedness'] ?? 0,
  };
}

/** FWCI del investigador = promedio de work.fwci (saltando nulos). */
export async function computeAuthorFwci(
  client: OpenAlexClient,
  authorId: string,
  opts: FwciOptions = {},
): Promise<FwciResult> {
  const { sinceYear, types, excludeParatext = true, byYear = false } = opts;
  const filter: string[] = [`authorships.author.id:${shortId(authorId)}`];
  if (excludeParatext) filter.push('is_paratext:false');
  if (sinceYear) filter.push(`from_publication_date:${sinceYear}-01-01`);
  if (types && types.length) filter.push(`type:${types.join('|')}`);

  const values: number[] = [];
  const perYear = new Map<number, number[]>();
  let nWorks = 0;

  for await (const w of client.iterWorks(filter.join(','), 'id,publication_year,type,fwci')) {
    nWorks++;
    if (w.fwci === null || w.fwci === undefined) continue;
    if (!fwciIsEligible({ y: w.publication_year, impact: w.fwci })) continue;
    values.push(w.fwci);
    if (byYear && w.publication_year) {
      const arr = perYear.get(w.publication_year) ?? [];
      arr.push(w.fwci);
      perYear.set(w.publication_year, arr);
    }
  }

  const mean = (xs: number[]): number => +(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(3);
  const result: FwciResult = {
    fwci: values.length ? mean(values) : null,
    nWorks,
    nWithFwci: values.length,
  };
  if (byYear) {
    result.fwciByYear = Object.fromEntries(
      [...perYear.entries()].sort((a, b) => a[0] - b[0]).map(([y, v]) => [String(y), mean(v)]),
    );
  }
  return result;
}

/**
 * % de publicaciones en revistas indexadas en Scopus (ISSN vs KBART).
 * scopusWorksTotal = obras con al menos un ISSN de revista en primary_location.
 */
export async function computeAuthorScopusIndex(
  client: OpenAlexClient,
  authorId: string,
  isScopusIndexed: (issns: Array<string | null | undefined>) => boolean,
  opts: { excludeParatext?: boolean } = {},
): Promise<ScopusIndexResult> {
  const { excludeParatext = true } = opts;
  const filter: string[] = [`authorships.author.id:${shortId(authorId)}`];
  if (excludeParatext) filter.push('is_paratext:false');

  let scopusWorksTotal = 0;
  let scopusIndexedN = 0;

  for await (const w of client.iterWorks(filter.join(','), 'id,type,primary_location')) {
    const issns = workJournalIssns(w);
    if (issns.length === 0) continue;
    scopusWorksTotal++;
    if (isScopusIndexed(issns)) scopusIndexedN++;
  }

  return {
    scopusIndexedRate:
      scopusWorksTotal > 0
        ? +((scopusIndexedN / scopusWorksTotal) * 100).toFixed(1)
        : null,
    scopusIndexedN,
    scopusWorksTotal,
  };
}

/** OpenAlex author id desde perfil persistido (openalex_id). */
export function authorIdFromStoredProfile(profile: { openalex_id?: string | null }): string {
  return shortId(profile.openalex_id ?? undefined);
}

/** Resuelve author id por ORCID cuando no está en openalex.json. */
export async function resolveAuthorIdByOrcid(
  client: OpenAlexClient,
  orcid: string,
): Promise<string | null> {
  const clean = orcid.replace(/^https?:\/\/orcid\.org\//i, '').trim();
  if (!clean) return null;
  const data = await client.get<AuthorsListResponse>('/authors', {
    filter: `orcid:${clean}`,
    'per-page': '1',
  });
  const id = data.results?.[0]?.id;
  return id ? shortId(id) : null;
}

/** Conteo de obras type=dataset (count-only, sin paginar obras). */
export async function computeDatasetsCount(
  client: OpenAlexClient,
  authorId: string,
): Promise<number> {
  return computeDatasetsCountForAuthorIds(client, [shortId(authorId)]);
}

/** Conteo datasets con OR sobre el set completo de author.id del investigador. */
export async function computeDatasetsCountForAuthorIds(
  client: OpenAlexClient,
  authorIds: string[],
): Promise<number> {
  const ids = [...new Set(authorIds.map((id) => shortId(id)).filter(Boolean))];
  if (!ids.length) return 0;
  const filter = `authorships.author.id:${ids.join('|')},type:dataset`;
  const data = await client.get<CountResponse>('/works', {
    filter,
    'per-page': '1',
  });
  return data.meta?.count ?? 0;
}

/** % Open Access vía group_by=open_access.is_oa. */
export async function computeOaRate(client: OpenAlexClient, authorId: string): Promise<OaRateResult> {
  const data = await client.get<GroupByResponse>('/works', {
    filter: `authorships.author.id:${shortId(authorId)}`,
    group_by: 'is_oa',
  });
  const counts: Record<string, number> = {};
  for (const g of data.group_by ?? []) {
    // OpenAlex en booleanos: key "1"/"0", key_display_name "true"/"false".
    // Normalizamos defensivamente a 'true'/'false'.
    const raw = String(g.key_display_name ?? g.key ?? '').toLowerCase();
    const norm =
      raw === '1' || raw === 'true' ? 'true' : raw === '0' || raw === 'false' ? 'false' : raw;
    counts[norm] = (counts[norm] ?? 0) + g.count;
  }
  const oaWorks = counts['true'] ?? 0;
  const totalWorks = oaWorks + (counts['false'] ?? 0);
  return {
    oaRate: totalWorks ? +((oaWorks / totalWorks) * 100).toFixed(1) : 0,
    oaWorks,
    totalWorks,
  };
}

/**
 * Arma el bloque `oa` completo que consume la ficha.
 * Persiste esto en autores_uta / Postgres; la ficha lee `oa.fwci` desde ahí.
 */
export async function buildAuthorOA(
  client: OpenAlexClient,
  orcidOrId: string,
  opts: { fwciSinceYear?: number; fwciByYear?: boolean } = {},
): Promise<AuthorOA> {
  const core = await getAuthorCore(client, orcidOrId);
  if (!core.authorId) throw new Error(`Autor no encontrado en OpenAlex: ${orcidOrId}`);

  const fwci = await computeAuthorFwci(client, core.authorId, {
    sinceYear: opts.fwciSinceYear,
    byYear: opts.fwciByYear,
  });
  const oar = await computeOaRate(client, core.authorId);
  const cpp = core.worksCount ? +(core.citedByCount / core.worksCount).toFixed(2) : 0;

  const out: AuthorOA = {
    ...core,
    citationsPerPub: cpp,
    fwci: fwci.fwci,
    fwciN: fwci.nWithFwci,
    oaRate: oar.oaRate,
    fetchedAt: new Date().toISOString(),
    source: 'openalex',
  };
  if (opts.fwciByYear && fwci.fwciByYear) out.fwciByYear = fwci.fwciByYear;
  return out;
}

/**
 * Ejemplo de uso (no se ejecuta al importar). Llámalo desde tu script de enriquecimiento:
 *
 *   await demo();
 */
export async function demo(): Promise<void> {
  const client = new OpenAlexClient({ mailto: 'fgarrido@rosflo.com' });
  const oa = await buildAuthorOA(client, '0000-0002-3298-6877', {
    fwciSinceYear: undefined, // p. ej. 2021 para "FWCI últimos años"
    fwciByYear: true,
  });
  console.log(JSON.stringify(oa, null, 2));
}
