import { useCallback, useEffect } from 'react';
import { useOpenResearcherProfile } from '../../app/hooks/useOpenResearcherProfile';
import { useApp } from '../../context/AppContext';
import type { Researcher } from '../../shared/types';
import { SDG_ES } from '../../utils/constants';
import { Pagination, EmptyState } from '../common/UIComponents';
import ResearcherProfileCard from '../researcher/ResearcherProfileCard';

export default function TabPerfiles() {
  const { openLocalResearcherProfile } = useOpenResearcherProfile();
  const {
    dept, setDept, onlyOrcid, sdgFilter, areaFilter,
    setSdgFilter, setAreaFilter, setOnlyOrcid,
    page, setPage, pageData, totalPages, filteredTotal, orcidTotal,
    DEPTS, deptCounts, goPerfiles, resetPage, researchersLoading,
  } = useApp();

  const openResearcherProfile = useCallback(
    (r: Researcher) => openLocalResearcherProfile(r),
    [openLocalResearcherProfile]
  );

  const handleDeptChange = useCallback(
    (e) => { setDept(e.target.value); resetPage(); },
    [setDept, resetPage]
  );

  const clearFilters = useCallback(() => {
    goPerfiles();
    setDept('');
    setSdgFilter('');
    setAreaFilter('');
    setOnlyOrcid(false);
  }, [goPerfiles, setDept, setSdgFilter, setAreaFilter, setOnlyOrcid]);

  const title = areaFilter
    ? `Área: ${areaFilter}`
    : sdgFilter
    ? `ODS: ${SDG_ES[sdgFilter] || sdgFilter}`
    : onlyOrcid
    ? 'Investigadores con ORCID'
    : dept
    ? dept
    : 'Perfiles';

  const toggleSoloOrcid = useCallback(() => {
    setOnlyOrcid(!onlyOrcid);
    resetPage();
  }, [onlyOrcid, setOnlyOrcid, resetPage]);

  useEffect(() => {
    if (page > totalPages - 1) setPage(0);
  }, [page, totalPages, setPage]);

  return (
    <>
      {/* Header with filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          {title}
          <span style={{ fontSize: 13, fontWeight: 400, color: '#888' }}>
            ({researchersLoading ? '…' : filteredTotal})
          </span>
          {orcidTotal > 0 && (
            <button
              type="button"
              className={`tp-chip-orcid${onlyOrcid ? ' is-active' : ''}`}
              onClick={toggleSoloOrcid}
              title={onlyOrcid ? 'Quitar filtro ORCID' : 'Ver solo investigadores con ORCID'}
            >
              {orcidTotal} ORCID
            </button>
          )}
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {(onlyOrcid || sdgFilter || areaFilter || dept) && (
            <button className="btn btn--ghost" onClick={clearFilters} style={{ fontSize: 12, padding: '5px 12px' }}>
              ✕ Limpiar
            </button>
          )}
          <select
            value={dept}
            onChange={handleDeptChange}
            className="filter-bar__select"
            style={{ maxWidth: 260 }}
            aria-label="Filtrar por unidad"
          >
            <option value="">Todas las unidades</option>
            {DEPTS.map((d) => (
              <option key={d} value={d}>
                {d} ({deptCounts[d] || 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Researcher Grid */}
      {pageData.length > 0 ? (
        <div className="grid grid--profiles">
          {pageData.map((r, i) => (
            <ResearcherProfileCard
              key={r.o || r.id || `${r.f}-${r.l}-${i}`}
              researcher={r}
              onClick={openResearcherProfile}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="🔍"
          title={researchersLoading ? 'Cargando…' : 'No se encontraron resultados'}
          message={
            researchersLoading
              ? 'Consultando el catálogo institucional.'
              : 'Intente con otros términos de búsqueda o filtros.'
          }
        />
      )}

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}
