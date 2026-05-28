import { memo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { getAuthorOA } from '../../utils/dataProcessing';
import type { Researcher } from '../../shared/types';
import { getColor, getInitials, shortDept } from '../../utils/helpers';
import { SDG_ES } from '../../utils/constants';
import { Pagination, EmptyState } from '../common/UIComponents';

interface ResearcherCardProps {
  researcher: Researcher;
  areaFilter: string;
  onClick: (r: Researcher) => void;
}

const ResearcherCard = memo(function ResearcherCard({ researcher, areaFilter, onClick }: ResearcherCardProps) {
  const r = researcher;
  const c = getColor((r.f || '') + (r.l || ''));
  const oa = getAuthorOA(r);

  return (
    <div className="card card--elevated researcher-card" onClick={() => onClick(r)}>
      {r.ph ? (
        <img
          src={`/photos/${r.ph}`}
          alt={`${r.f} ${r.l}`}
          className="researcher-card__avatar"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          loading="lazy"
        />
      ) : (
        <div className="researcher-card__avatar-placeholder" style={{ background: c }}>
          {getInitials(r.f, r.l)}
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="researcher-card__name">{r.f} {r.l}</div>
        {r.t && <div className="researcher-card__title">{r.t}</div>}
        <div className="researcher-card__meta">
          {(r.dp || [])[0]?.d && (
            <span className="chip chip--dept">{shortDept(r.dp[0].d)}</span>
          )}
          {r.o && <span className="chip chip--orcid">● ORCID</span>}
          {oa && (
            <span style={{ fontSize: 9, color: '#888' }}>
              h={oa.h_index} ·{' '}
              {areaFilter
                ? `${(oa.works || []).filter((w) => w.field === areaFilter).length} en ${areaFilter}`
                : `${(oa.works || []).length || oa.works_count} pub`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export default function TabPerfiles() {
  const {
    search, dept, setDept, onlyOrcid, sdgFilter, areaFilter,
    setSdgFilter, setAreaFilter, setOnlyOrcid,
    filtered, pageData, page, setPage, totalPages,
    DEPTS, deptCounts, goPerfiles, openResearcher, resetPage,
  } = useApp();

  const handleDeptChange = useCallback(
    (e) => { setDept(e.target.value); resetPage(); },
    [setDept, resetPage]
  );

  const clearFilters = useCallback(() => {
    goPerfiles();
    setSdgFilter('');
    setAreaFilter('');
  }, [goPerfiles, setSdgFilter, setAreaFilter]);

  const title = areaFilter
    ? `Área: ${areaFilter}`
    : sdgFilter
    ? `ODS: ${SDG_ES[sdgFilter] || sdgFilter}`
    : onlyOrcid
    ? 'Investigadores con ORCID'
    : 'Perfiles';

  return (
    <>
      {/* Intro text when no filters are active */}
      {!search && !dept && !onlyOrcid && !sdgFilter && (
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
          {(onlyOrcid || sdgFilter || areaFilter) && (
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
            <ResearcherCard
              key={r.o || `${r.f}-${r.l}-${i}`}
              researcher={r}
              areaFilter={areaFilter}
              onClick={openResearcher}
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
