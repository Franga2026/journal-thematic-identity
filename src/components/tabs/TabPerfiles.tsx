import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOpenResearcherProfile } from '../../app/hooks/useOpenResearcherProfile';
import { useApp } from '../../context/AppContext';
import type { Researcher } from '../../shared/types';
import { PAGE_SIZE, SDG_ES } from '../../utils/constants';
import { Pagination, EmptyState } from '../common/UIComponents';
import ResearcherProfileCard from '../researcher/ResearcherProfileCard';

export default function TabPerfiles() {
  const { openLocalResearcherProfile } = useOpenResearcherProfile();
  const {
    dept, setDept, onlyOrcid, sdgFilter, areaFilter,
    setSdgFilter, setAreaFilter, setOnlyOrcid,
    filtered, page, setPage,
    DEPTS, deptCounts, goPerfiles, resetPage,
  } = useApp();

  const [soloOrcid, setSoloOrcid] = useState(false);

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
    setSoloOrcid(false);
  }, [goPerfiles, setDept, setSdgFilter, setAreaFilter, setOnlyOrcid]);

  const title = areaFilter
    ? `Área: ${areaFilter}`
    : sdgFilter
    ? `ODS: ${SDG_ES[sdgFilter] || sdgFilter}`
    : soloOrcid || onlyOrcid
    ? 'Investigadores con ORCID'
    : dept
    ? dept
    : 'Perfiles';

  const orcidCount = useMemo(
    () => filtered.filter((r) => r.o).length,
    [filtered]
  );

  const visibles = useMemo(
    () => (soloOrcid ? filtered.filter((r) => r.o) : filtered),
    [filtered, soloOrcid]
  );

  const totalPages = Math.max(1, Math.ceil(visibles.length / PAGE_SIZE));
  const pageData = visibles.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages - 1) setPage(0);
  }, [page, totalPages, setPage]);

  const toggleSoloOrcid = useCallback(() => {
    setSoloOrcid((v) => !v);
    resetPage();
  }, [resetPage]);

  return (
    <>
      {/* Header with filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          {title}
          <span style={{ fontSize: 13, fontWeight: 400, color: '#888' }}>
            ({visibles.length})
          </span>
          {orcidCount > 0 && (
            <button
              type="button"
              className={`tp-chip-orcid${soloOrcid ? ' is-active' : ''}`}
              onClick={toggleSoloOrcid}
              title={soloOrcid ? 'Quitar filtro ORCID' : 'Ver solo investigadores con ORCID'}
            >
              {orcidCount} ORCID
            </button>
          )}
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {(soloOrcid || onlyOrcid || sdgFilter || areaFilter || dept) && (
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
              key={r.o || `${r.f}-${r.l}-${i}`}
              researcher={r}
              onClick={openResearcherProfile}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="🔍"
          title="No se encontraron resultados"
          message="Intente con otros términos de búsqueda o filtros."
        />
      )}

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}
