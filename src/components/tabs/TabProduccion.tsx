import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  getAW,
  getInstitution,
  filterWorks,
  buildWorkFacets,
} from '../../utils/dataProcessing';
import { WORKS_PAGE_SIZE } from '../../utils/constants';
import { sortWorks, type SortKey } from '../../utils/sortWorks';
import { useDebounce } from '../../app/hooks/useDebounce';
import {
  fetchWorks,
  mapApiWorkToWork,
  type WorksApiResponse,
  type WorksFacets,
} from '../../services/catalog/fetchWorks';
import { Pagination } from '../common/UIComponents';
import ProductionSearchBar from '../production/ProductionSearchBar';
import ProductionWorkList from '../production/ProductionWorkList';
import ProductionFacets from '../production/ProductionFacets';
import type { Work } from '../../shared/types';

const EMPTY_FACETS: WorksFacets = {
  year: [],
  type: [],
  quartile: [],
  access: [],
  field: [],
};

const USE_WORKS_API = import.meta.env.MODE !== 'test';

function countMapToBuckets(
  items: { name: string; count: number }[]
): { key: string; count: number }[] {
  return items.map((i) => ({ key: i.name, count: i.count }));
}

export default function TabProduccion() {
  const {
    workSearch,
    setWorkSearch,
    workYear,
    setWorkYear,
    workType,
    setWorkType,
    workAccess,
    setWorkAccess,
    workQuartile,
    setWorkQuartile,
    workTopic,
    setWorkTopic,
    workField,
    setWorkField,
    workSdg,
    setWorkSdg,
    workPage,
    setWorkPage,
  } = useApp();

  const [sortBy, setSortBy] = useState<SortKey>('citations');
  const debouncedSearch = useDebounce(workSearch, 300);

  const [useApi, setUseApi] = useState(USE_WORKS_API);
  const [items, setItems] = useState<Work[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [facets, setFacets] = useState<WorksFacets>(EMPTY_FACETS);
  const [loading, setLoading] = useState(false);
  const [oaTotal, setOaTotal] = useState(0);

  const AW = getAW();
  const INST = getInstitution();
  const corpusTotal = INST.works_count ?? (AW || []).length;

  const resetWorkPage = useCallback(() => setWorkPage(0), [setWorkPage]);

  // ── Fallback local (tests / API caída) ──────────────────────────────
  const filterParams = useMemo(
    () => ({
      search: workSearch,
      year: workYear,
      type: workType,
      access: workAccess,
      quartile: workQuartile,
      field: workField,
      topic: workTopic,
      sdg: workSdg,
    }),
    [
      workSearch,
      workYear,
      workType,
      workAccess,
      workQuartile,
      workField,
      workTopic,
      workSdg,
    ]
  );

  const localFiltered = useMemo(() => filterWorks(filterParams), [filterParams]);
  const localSorted = useMemo(
    () => sortWorks(localFiltered, sortBy),
    [localFiltered, sortBy]
  );
  const localPages = Math.max(1, Math.ceil(localSorted.length / WORKS_PAGE_SIZE));
  const localPageData = useMemo(
    () =>
      localSorted.slice(
        workPage * WORKS_PAGE_SIZE,
        (workPage + 1) * WORKS_PAGE_SIZE
      ),
    [localSorted, workPage]
  );

  const localFacets = useMemo((): WorksFacets => {
    if (useApi) return EMPTY_FACETS;
    const fy = buildWorkFacets(filterWorks({ ...filterParams, year: '' }));
    const ft = buildWorkFacets(filterWorks({ ...filterParams, type: '' }));
    const fq = buildWorkFacets(filterWorks({ ...filterParams, quartile: '' }));
    const fa = buildWorkFacets(filterWorks({ ...filterParams, access: '' }));
    const fTop = buildWorkFacets(
      filterWorks({ ...filterParams, topic: '', field: '' })
    );
    return {
      year: countMapToBuckets(fy.years),
      type: countMapToBuckets(ft.types),
      quartile: countMapToBuckets(fq.quartiles),
      access: countMapToBuckets(fa.access),
      field: countMapToBuckets(fTop.topics),
    };
  }, [useApi, filterParams]);

  useEffect(() => {
    setWorkPage(0);
  }, [sortBy, setWorkPage]);

  useEffect(() => {
    if (!USE_WORKS_API || !useApi) return;

    const ac = new AbortController();
    setLoading(true);

    const fieldOrTopic = workField || workTopic || undefined;

    fetchWorks(
      {
        q: debouncedSearch.trim().length >= 2 ? debouncedSearch : undefined,
        year: workYear || undefined,
        type: workType || undefined,
        access: workAccess || undefined,
        quartile: workQuartile || undefined,
        field: fieldOrTopic,
        sdg: workSdg || undefined,
        sort: sortBy,
        page: workPage + 1,
        per_page: WORKS_PAGE_SIZE,
      },
      ac.signal
    )
      .then((data: WorksApiResponse | null) => {
        if (ac.signal.aborted) return;
        if (!data) {
          setUseApi(false);
          return;
        }
        setItems(data.items.map(mapApiWorkToWork));
        setTotal(data.total);
        setPages(Math.max(1, data.pages));
        setFacets({
          year: data.facets?.year || [],
          type: data.facets?.type || [],
          quartile: data.facets?.quartile || [],
          access: data.facets?.access || [],
          field: data.facets?.field || [],
        });
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [
    debouncedSearch,
    workYear,
    workType,
    workAccess,
    workQuartile,
    workTopic,
    workField,
    workSdg,
    sortBy,
    workPage,
    useApi,
  ]);

  // OA KPI institucional (sin filtro de acceso)
  useEffect(() => {
    if (!USE_WORKS_API || !useApi) {
      setOaTotal(filterWorks({ access: 'open' }).length);
      return;
    }
    const ac = new AbortController();
    fetchWorks(
      { access: 'open', page: 1, per_page: 1, sort: 'year' },
      ac.signal
    ).then((data) => {
      if (!ac.signal.aborted && data) setOaTotal(data.total);
    });
    return () => ac.abort();
  }, [useApi]);

  const displayItems = useApi ? items : localPageData;
  const displayTotal = useApi ? total : localSorted.length;
  const displayPages = useApi ? pages : localPages;
  const displayFacets = useApi ? facets : localFacets;

  const hasActiveFilters = Boolean(
    workSearch.trim() ||
      workYear ||
      workType ||
      workAccess ||
      workQuartile ||
      workTopic ||
      workField ||
      workSdg
  );

  const clearFilters = useCallback(() => {
    setWorkSearch('');
    setWorkYear('');
    setWorkType('');
    setWorkAccess('');
    setWorkQuartile('');
    setWorkTopic('');
    setWorkField('');
    setWorkSdg('');
    resetWorkPage();
  }, [
    setWorkSearch,
    setWorkYear,
    setWorkType,
    setWorkAccess,
    setWorkQuartile,
    setWorkTopic,
    setWorkField,
    setWorkSdg,
    resetWorkPage,
  ]);

  useEffect(() => {
    if (workPage > displayPages - 1) setWorkPage(0);
  }, [workPage, displayPages, setWorkPage]);

  return (
    <div className="production-page">
      <header className="production-page__header">
        <h2 className="production-page__title">Producción Científica</h2>
        <div className="production-page__kpis">
          {[
            { l: 'Publicaciones', v: corpusTotal, c: 'var(--blue-700)' },
            { l: 'Citas', v: INST.cited_by_count, c: '#2a7a8a' },
            { l: 'H-index', v: INST.h_index, c: '#4C9F38' },
            { l: 'Open Access', v: oaTotal, c: '#FD6925' },
          ].map((m) => (
            <div key={m.l} className="kpi-card production-page__kpi">
              <div className="kpi-card__value" style={{ color: m.c }}>
                {(m.v || 0).toLocaleString()}
              </div>
              <div className="kpi-card__label">{m.l}</div>
            </div>
          ))}
        </div>
      </header>

      <ProductionSearchBar
        value={workSearch}
        onChange={(v) => {
          setWorkSearch(v);
          resetWorkPage();
        }}
        resultCount={displayTotal}
        totalCount={corpusTotal}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      <div className="production-layout">
        <main className="production-layout__main">
          {loading && useApi && displayItems.length === 0 ? (
            <p className="muted" style={{ padding: 24 }}>
              Cargando producción…
            </p>
          ) : (
            <ProductionWorkList works={displayItems} />
          )}
          <Pagination
            page={workPage}
            totalPages={displayPages}
            onPageChange={setWorkPage}
          />
        </main>

        <details className="production-facets-drawer" open>
          <summary className="production-facets-drawer__summary">Filtros</summary>
          <ProductionFacets
            facets={displayFacets}
            workYear={workYear}
            workType={workType}
            workQuartile={workQuartile}
            workAccess={workAccess}
            workTopic={workTopic}
            setWorkYear={setWorkYear}
            setWorkType={setWorkType}
            setWorkQuartile={setWorkQuartile}
            setWorkAccess={setWorkAccess}
            setWorkTopic={setWorkTopic}
            onFilterChange={resetWorkPage}
          />
        </details>
      </div>
    </div>
  );
}
