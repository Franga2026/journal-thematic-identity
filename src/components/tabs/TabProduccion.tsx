import { useMemo, useCallback, useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { getAW, getInstitution, filterWorks } from '../../utils/dataProcessing';
import { WORKS_PAGE_SIZE } from '../../utils/constants';
import { sortWorks, type SortKey } from '../../utils/sortWorks';
import { Pagination } from '../common/UIComponents';
import ProductionSearchBar from '../production/ProductionSearchBar';
import ProductionWorkList from '../production/ProductionWorkList';
import ProductionFacets from '../production/ProductionFacets';

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

  const AW = getAW();
  const INST = getInstitution();
  const totalCount = (AW || []).length;

  const filterParams = useMemo(
    () => ({
      search: workSearch,
      year: workYear,
      type: workType,
      access: workAccess,
      field: workField,
      topic: workTopic,
      sdg: workSdg,
    }),
    [workSearch, workYear, workType, workAccess, workField, workTopic, workSdg]
  );

  const fw = useMemo(() => filterWorks(filterParams), [filterParams]);

  useEffect(() => {
    setWorkPage(0);
  }, [sortBy, setWorkPage]);

  const sorted = useMemo(() => sortWorks(fw, sortBy), [fw, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / WORKS_PAGE_SIZE));
  const pageData = useMemo(
    () => sorted.slice(workPage * WORKS_PAGE_SIZE, (workPage + 1) * WORKS_PAGE_SIZE),
    [sorted, workPage]
  );

  const resetWorkPage = useCallback(() => setWorkPage(0), [setWorkPage]);

  const worksForYears = useMemo(
    () => filterWorks({ ...filterParams, year: '' }),
    [filterParams]
  );
  const worksForTypes = useMemo(
    () => filterWorks({ ...filterParams, type: '' }),
    [filterParams]
  );
  const worksForAccess = useMemo(
    () => filterWorks({ ...filterParams, access: '' }),
    [filterParams]
  );
  const worksForTopics = useMemo(
    () => filterWorks({ ...filterParams, topic: '', field: '' }),
    [filterParams]
  );

  const hasActiveFilters = Boolean(
    workSearch.trim() ||
      workYear ||
      workType ||
      workAccess ||
      workTopic ||
      workField ||
      workSdg
  );

  const clearFilters = useCallback(() => {
    setWorkSearch('');
    setWorkYear('');
    setWorkType('');
    setWorkAccess('');
    setWorkTopic('');
    setWorkField('');
    setWorkSdg('');
    resetWorkPage();
  }, [
    setWorkSearch,
    setWorkYear,
    setWorkType,
    setWorkAccess,
    setWorkTopic,
    setWorkField,
    setWorkSdg,
    resetWorkPage,
  ]);

  return (
    <div className="production-page">
      <header className="production-page__header">
        <h2 className="production-page__title">Producción Científica</h2>
        <div className="production-page__kpis">
          {[
            { l: 'Publicaciones', v: INST.works_count ?? totalCount, c: 'var(--blue-700)' },
            { l: 'Citas', v: INST.cited_by_count, c: '#2a7a8a' },
            { l: 'H-index', v: INST.h_index, c: '#4C9F38' },
            { l: 'Open Access', v: (AW || []).filter((w) => w.oa).length, c: '#FD6925' },
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
        resultCount={fw.length}
        totalCount={totalCount}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      <div className="production-layout">
        <main className="production-layout__main">
          <ProductionWorkList works={pageData} />
          <Pagination page={workPage} totalPages={totalPages} onPageChange={setWorkPage} />
        </main>

        <details className="production-facets-drawer" open>
          <summary className="production-facets-drawer__summary">Filtros</summary>
          <ProductionFacets
          worksForYears={worksForYears}
          worksForTypes={worksForTypes}
          worksForAccess={worksForAccess}
          worksForTopics={worksForTopics}
          workYear={workYear}
          workType={workType}
          workAccess={workAccess}
          workTopic={workTopic}
          setWorkYear={setWorkYear}
          setWorkType={setWorkType}
          setWorkAccess={setWorkAccess}
          setWorkTopic={setWorkTopic}
          onFilterChange={resetWorkPage}
          />
        </details>
      </div>
    </div>
  );
}
