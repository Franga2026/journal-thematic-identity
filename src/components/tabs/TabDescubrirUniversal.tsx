/**
 * TabDescubrirUniversal — Descubridor bibliográfico universal (OpenAlex).
 * UI alineada al mockup Capa A: facetas, sort en barra de resultados,
 * tarjetas enriquecidas (datasets), mini-análisis y export BibTeX.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import DiscoveryWorkCard from '../discovery/DiscoveryWorkCard';
import {
  searchWorks,
  getFacets,
  workResultToWork,
  DiscoveryError,
  type SearchResponse,
  type FacetsResponse,
  type WorkResult,
  type SortMode,
  isTechnicalChipLabel,
} from '../../services/discovery/universalSearch';
import { buildCitation } from '../../utils/citation/buildCitation';

const SORT_LABELS: { key: SortMode; label: string }[] = [
  { key: 'relevance', label: 'Relevancia' },
  { key: 'citations', label: 'Más citadas' },
  { key: 'date', label: 'Recientes' },
  { key: 'date_asc', label: 'Antiguas' },
];

const OA_COLORS: Record<string, string> = {
  gold: '#EF9F27', green: '#639922', hybrid: '#378ADD',
  bronze: '#B4B2A9', diamond: '#3FA7A2', closed: '#5F5E5A',
};

const FWCI_OPTIONS = [
  { value: 0, label: 'Todas' },
  { value: 2, label: 'Alto · > 2' },
  { value: 5, label: 'Muy alto · > 5' },
];

const Q_COLORS: Record<string, string> = {
  Q1: '#15803D', Q2: '#CA8A04', Q3: '#EA580C', Q4: '#888888',
};

const SJR_QUARTILE_KEYS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

function mergeQuartileFacets(
  buckets: { key: string; label: string; count: number }[] | undefined,
) {
  const byKey = new Map((buckets ?? []).map((b) => [b.key, b]));
  return SJR_QUARTILE_KEYS.map((q) => byKey.get(q) ?? { key: q, label: q, count: 0 });
}

interface ActiveFilters {
  type: string | null;
  oaStatus: string | null;
  field: string | null;
  publisher: string | null;
  repository: string | null;
  datasetRepository: string | null;
  quartile: string | null;
  fwciMin: number;
}

const EMPTY_FILTERS: ActiveFilters = {
  type: null, oaStatus: null, field: null, publisher: null, repository: null,
  datasetRepository: null, quartile: null, fwciMin: 0,
};

type StringFilterKey =
  | 'type' | 'oaStatus' | 'field' | 'publisher' | 'repository' | 'datasetRepository' | 'quartile';

function fmt(n: number): string {
  return n.toLocaleString('es-CL');
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return fmt(n);
}

function DbIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className="dw-db-icon">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

const PUBLISHER_FACET_LIMIT = 20;

function DiscoveryFacetBlock({
  title,
  kind,
  buckets,
  selected,
  onToggle,
  limit = 6,
  expandable = false,
  colorFn,
  showDatasetIcon,
  showRepoIcon,
}: {
  title: string;
  kind: StringFilterKey;
  buckets: { key: string; label: string; count: number }[];
  selected: string | null;
  onToggle: (kind: StringFilterKey, value: string) => void;
  limit?: number;
  expandable?: boolean;
  colorFn?: (key: string) => string;
  showDatasetIcon?: boolean;
  showRepoIcon?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!buckets.length) return null;

  const canExpand = expandable && buckets.length > limit;
  const visible = canExpand && !expanded ? buckets.slice(0, limit) : buckets;

  return (
    <div className="descubrir-universal__facet">
      <h4 className="descubrir-universal__facet-title">{title}</h4>
      {visible.map((b) => (
        <label key={b.key} className="descubrir-universal__facet-opt">
          <input
            type="checkbox"
            checked={selected === b.key}
            onChange={() => onToggle(kind, b.key)}
          />
          {colorFn && (
            <span
              className="descubrir-universal__facet-dot"
              style={{ background: colorFn(b.key) || '#ccc' }}
            />
          )}
          {showDatasetIcon && (kind === 'datasetRepository' || b.key === 'dataset') && (
            <DbIcon size={12} />
          )}
          <span className="descubrir-universal__facet-label">{b.label}</span>
          <span className="descubrir-universal__facet-count">{fmtCompact(b.count)}</span>
        </label>
      ))}
      {canExpand && (
        <button
          type="button"
          className="descubrir-universal__facet-more"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '▲ Menos' : `▼ Ver ${buckets.length - limit} más`}
        </button>
      )}
    </div>
  );
}

export default function TabDescubrirUniversal() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';

  const [sort, setSort] = useState<SortMode>('relevance');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [facets, setFacets] = useState<FacetsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const lastKey = useRef<string>('');

  const runSearch = useCallback(
    async (query: string, pageArg: number, sortArg: SortMode, f: ActiveFilters) => {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setData(null); setError(null); return;
      }
      const key = JSON.stringify([trimmed.toLowerCase(), pageArg, sortArg, f]);
      if (key === lastKey.current) return;
      lastKey.current = key;

      setLoading(true); setError(null);
      try {
        const res = await searchWorks({
          q: trimmed, page: pageArg, perPage: 25, sort: sortArg,
          type: f.type || undefined,
          oaStatus: f.oaStatus || undefined,
          field: f.field || undefined,
          publisher: f.publisher || undefined,
          repository: f.repository || undefined,
          datasetRepository: f.datasetRepository || undefined,
          fwciMin: f.fwciMin || undefined,
          quartile: f.quartile || undefined,
        });
        setData(res);
      } catch (e) {
        setError(e instanceof DiscoveryError ? e.message : 'Error al buscar. Intenta de nuevo.');
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadFacets = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) { setFacets(null); return; }
    try {
      setFacets(await getFacets(trimmed));
    } catch {
      setFacets(null);
    }
  }, []);

  useEffect(() => {
    if (q && q.trim().length >= 2) {
      setPage(1);
      setFilters(EMPTY_FILTERS);
      lastKey.current = '';
      runSearch(q, 1, sort, EMPTY_FILTERS);
      loadFacets(q);
    } else {
      setData(null); setFacets(null); setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const applyFilters = (next: ActiveFilters) => {
    setFilters(next);
    setPage(1);
    lastKey.current = '';
    runSearch(q, 1, sort, next);
  };

  const toggleFilter = (kind: StringFilterKey, value: string) => {
    const current = filters[kind];
    const next: ActiveFilters = { ...filters, [kind]: current === value ? null : value };
    if (kind === 'publisher' && next.publisher) {
      next.repository = null;
      next.datasetRepository = null;
    }
    if (kind === 'repository' && next.repository) {
      next.publisher = null;
      next.datasetRepository = null;
      if (next.type === 'dataset') next.type = null;
    }
    if (kind === 'datasetRepository' && next.datasetRepository) {
      next.publisher = null;
      next.repository = null;
      next.type = null;
    }
    if (kind === 'type' && next.type === 'dataset') {
      next.repository = null;
    }
    applyFilters(next);
  };

  const setFwci = (v: number) => applyFilters({ ...filters, fwciMin: v });

  const handleSortChange = (next: SortMode) => {
    setSort(next); setPage(1); lastKey.current = '';
    runSearch(q, 1, next, filters);
  };

  const goToPage = (next: number) => {
    if (next < 1) return;
    setPage(next);
    lastKey.current = '';
    runSearch(q, next, sort, filters);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const exportBibtex = () => {
    if (!data?.results.length) return;
    const body = data.results
      .map((r) => buildCitation(workResultToWork(r), 'bibtex'))
      .join('\n\n');
    const blob = new Blob([body], { type: 'application/x-bibtex;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `descubridor-${q.slice(0, 40).replace(/\s+/g, '-')}.bib`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const analysis = useMemo(() => {
    const rows = data?.results ?? [];
    if (!rows.length) return null;
    const oaPct = Math.round(rows.filter((r) => r.is_oa).length / rows.length * 100);
    const withFwci = rows.filter((r) => r.fwci != null);
    const avgFwci = withFwci.length
      ? withFwci.reduce((s, r) => s + (r.fwci ?? 0), 0) / withFwci.length
      : 0;
    const datasets = rows.filter((r) => r.type === 'dataset').length;
    const withQ = rows.filter((r) => r.quartile);
    const q1 = withQ.filter((r) => r.quartile === 'Q1').length;
    const qPct = withQ.length ? Math.round(q1 / withQ.length * 100) : 0;
    return { oaPct, avgFwci, datasets, pageCount: rows.length, qPct, withQ: withQ.length };
  }, [data?.results]);

  const publisherFacets = useMemo(
    () => (facets?.publishers ?? []).filter((b) => !isTechnicalChipLabel(b.label)),
    [facets?.publishers],
  );

  const repositoryFacets = useMemo(
    () => (facets?.repositories ?? []).filter((b) => !isTechnicalChipLabel(b.label)),
    [facets?.repositories],
  );

  const datasetRepositoryFacets = useMemo(
    () => (facets?.dataset_repositories ?? []).filter((b) => !isTechnicalChipLabel(b.label)),
    [facets?.dataset_repositories],
  );

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 0;

  return (
    <div className="tab-descubrir-universal dw-wrap">
      <div className="descubrir-universal__layout">
        <aside className="descubrir-universal__sidebar">
          <DiscoveryFacetBlock
            title="Área temática"
            kind="field"
            buckets={facets?.fields ?? []}
            selected={filters.field}
            onToggle={toggleFilter}
          />
          <DiscoveryFacetBlock
            title="Tipo"
            kind="type"
            buckets={facets?.types ?? []}
            selected={filters.type}
            onToggle={toggleFilter}
            showDatasetIcon
          />
          <DiscoveryFacetBlock
            title="Acceso abierto"
            kind="oaStatus"
            buckets={facets?.oa_status ?? []}
            selected={filters.oaStatus}
            onToggle={toggleFilter}
            colorFn={(k) => OA_COLORS[k]}
          />
          <DiscoveryFacetBlock
            title="Editorial"
            kind="publisher"
            buckets={publisherFacets}
            selected={filters.publisher}
            onToggle={toggleFilter}
            limit={PUBLISHER_FACET_LIMIT}
            expandable
          />
          <DiscoveryFacetBlock
            title="Repositorio"
            kind="repository"
            buckets={repositoryFacets}
            selected={filters.repository}
            onToggle={toggleFilter}
            limit={PUBLISHER_FACET_LIMIT}
            expandable
            showRepoIcon
          />
          <DiscoveryFacetBlock
            title="Repositorio de datos"
            kind="datasetRepository"
            buckets={datasetRepositoryFacets}
            selected={filters.datasetRepository}
            onToggle={toggleFilter}
            limit={PUBLISHER_FACET_LIMIT}
            expandable
            showDatasetIcon
          />
          <DiscoveryFacetBlock
            title="Cuartil SJR"
            kind="quartile"
            buckets={mergeQuartileFacets(facets?.quartiles)}
            selected={filters.quartile}
            onToggle={toggleFilter}
            colorFn={(k) => Q_COLORS[k]}
          />

          <div className="descubrir-universal__facet">
            <h4 className="descubrir-universal__facet-title">Impacto (FWCI)</h4>
            <div className="descubrir-universal__sort-list">
              {FWCI_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setFwci(o.value)}
                  className={`descubrir-universal__fwci-btn${filters.fwciMin === o.value ? ' is-active' : ''}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="descubrir-universal__content">
          {data && (
            <div className="descubrir-universal__toolbar">
              <span className="descubrir-universal__meta">
                {fmt(data.total)} resultados{data.cached && ' · desde caché'}
              </span>
              <div className="descubrir-universal__sort-row">
                {SORT_LABELS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSortChange(key)}
                    className={`descubrir-universal__sort-btn${sort === key ? ' is-active' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {data && data.results.length > 0 && (
            <div className="descubrir-universal__actions">
              <button type="button" className="dw-act dw-act--primary" onClick={exportBibtex}>
                Exportar BibTeX
              </button>
              <button
                type="button"
                className="dw-act dw-act--ghost"
                onClick={() => setShowAnalysis((v) => !v)}
              >
                Mini-análisis
              </button>
            </div>
          )}

          {showAnalysis && analysis && data && (
            <div className="dw-analysis">
              <div className="dw-analysis__title">Análisis de la búsqueda (página actual)</div>
              <div className="dw-analysis__stats">
                <div className="dw-analysis__stat">
                  <div className="dw-analysis__stat-val">{fmt(analysis.pageCount)}</div>
                  <div className="dw-analysis__stat-lbl">en página</div>
                </div>
                <div className="dw-analysis__stat">
                  <div className="dw-analysis__stat-val dw-analysis__stat-val--green">{analysis.oaPct}%</div>
                  <div className="dw-analysis__stat-lbl">OA</div>
                </div>
                <div className="dw-analysis__stat">
                  <div className="dw-analysis__stat-val dw-analysis__stat-val--teal">{analysis.avgFwci.toFixed(1)}</div>
                  <div className="dw-analysis__stat-lbl">FWCI prom.</div>
                </div>
                <div className="dw-analysis__stat">
                  <div className="dw-analysis__stat-val dw-analysis__stat-val--purple">{analysis.datasets}</div>
                  <div className="dw-analysis__stat-lbl">datasets</div>
                </div>
                {analysis.withQ > 0 && (
                  <div className="dw-analysis__stat">
                    <div className="dw-analysis__stat-val dw-analysis__stat-val--green">{analysis.qPct}%</div>
                    <div className="dw-analysis__stat-lbl">Q1 (página)</div>
                  </div>
                )}
              </div>
              <p className="descubrir-universal__facet-hint">
                Total en OpenAlex: {fmt(data.total)} obras
              </p>
            </div>
          )}

          {loading && <div className="descubrir-universal__state">Buscando en OpenAlex…</div>}
          {error && !loading && (
            <div className="descubrir-universal__state descubrir-universal__state--error">{error}</div>
          )}
          {!loading && !error && data && data.results.length === 0 && (
            <div className="descubrir-universal__state">
              No se encontraron resultados para “{data.query}” con estos filtros.
            </div>
          )}
          {!loading && !error && !data && (
            <div className="descubrir-universal__state">
              Escribe un término y presiona Buscar para explorar 474 millones de obras.
            </div>
          )}

          {!loading && !error && data && data.results.length > 0 && (
            <>
              <div className="descubrir-universal__grid">
                {data.results.map((r: WorkResult) => (
                  <DiscoveryWorkCard key={r.openalex_id} r={r} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="descubrir-universal__pagination">
                  <button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1}
                    className="descubrir-universal__page-btn">Anterior</button>
                  <span className="descubrir-universal__page-info">
                    Página {page} de {fmt(totalPages)}
                  </span>
                  <button type="button" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}
                    className="descubrir-universal__page-btn">Siguiente</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
