import { useCallback } from 'react';
import { useOpenResearcherProfile } from '../../app/hooks/useOpenResearcherProfile';
import { useApp } from '../../context/AppContext';
import type { Researcher } from '../../shared/types';
import { SDG_ES } from '../../utils/constants';
import { Pagination, EmptyState } from '../common/UIComponents';
import ResearcherProfileCard from '../researcher/ResearcherProfileCard';

export default function TabPerfiles() {
  const { openLocalResearcherProfile } = useOpenResearcherProfile();
  const {
    search, dept, setDept, onlyOrcid, sdgFilter, areaFilter,
    setSdgFilter, setAreaFilter, setOnlyOrcid,
    filtered, pageData, page, setPage, totalPages,
    DEPTS, deptCounts, goPerfiles, resetPage,
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

  return (
    <>
      {/* Intro text when no filters are active */}
      {!search && !dept && !onlyOrcid && !sdgFilter && !areaFilter && (
        <div className="info-box">
          La <strong style={{ color: 'var(--blue-700)' }}>Universidad de Tarapacá</strong> pone a
          disposición de la comunidad académica el perfil de sus investigadores. Datos enriquecidos
          con{' '}
          <a href="https://openalex.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-700)' }}>
            OpenAlex
          </a>{' '}
          y{' '}
          <a href="https://orcid.org" target="_blank" rel="noopener noreferrer" style={{ color: '#A6CE39' }}>
            ORCID
          </a>.
        </div>
      )}

      {/* Header with filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
          {title}
          <span style={{ fontSize: 13, fontWeight: 400, color: '#888', marginLeft: 8 }}>
            ({filtered.length})
          </span>
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
