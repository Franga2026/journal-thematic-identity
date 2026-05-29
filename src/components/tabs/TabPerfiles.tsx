import { memo, useCallback, type SyntheticEvent } from 'react';
import { useOpenResearcherProfile } from '../../app/hooks/useOpenResearcherProfile';
import { useApp } from '../../context/AppContext';
import { getAuthorOA } from '../../utils/dataProcessing';
import type { Researcher } from '../../shared/types';
import { getColor, getInitials, shortDept, cleanOrcid } from '../../utils/helpers';
import { getOrcidRecordUrl } from '../../utils/researcherProfile';
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
  const fullName = `${r.f || ''} ${r.l || ''}`.trim() || 'Sin nombre';
  const position = r.t?.trim() || 'Sin cargo';
  const deptName = (r.dp || [])[0]?.d;
  const discipline = deptName ? shortDept(deptName) : 'Sin unidad';
  const orcidId = cleanOrcid(r.o);
  const hasOrcid = Boolean(orcidId);
  const orcidUrl = getOrcidRecordUrl(r.o);
  const hIndex = oa?.h_index ?? 0;
  const pubCount = areaFilter
    ? (oa?.works || []).filter((w) => w.field === areaFilter).length
    : (oa?.works?.length ?? oa?.works_count ?? 0);

  const handlePhotoError = (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.style.display = 'none';
    const fallback = img.nextElementSibling as HTMLElement | null;
    if (fallback) fallback.style.display = 'flex';
  };

  return (
    <div className="card card--elevated researcher-card" onClick={() => onClick(r)}>
      <div className="researcher-card__avatar-slot" aria-hidden>
        {r.ph ? (
          <>
            <img
              src={`/photos/${r.ph}`}
              alt=""
              className="researcher-card__avatar"
              onError={handlePhotoError}
              loading="lazy"
            />
            <div
              className="researcher-card__avatar-placeholder researcher-card__avatar-placeholder--fallback"
              style={{ background: c, display: 'none' }}
            >
              {getInitials(r.f, r.l)}
            </div>
          </>
        ) : (
          <div className="researcher-card__avatar-placeholder" style={{ background: c }}>
            {getInitials(r.f, r.l)}
          </div>
        )}
      </div>

      <div className="researcher-card__body">
        <div className="researcher-card__name" title={fullName}>{fullName}</div>
        <div className="researcher-card__title" title={position}>{position}</div>
        <div className="researcher-card__dept" title={deptName || discipline}>{discipline}</div>
        <div className="researcher-card__footer">
          {hasOrcid && orcidUrl ? (
            <a
              href={orcidUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="chip chip--orcid researcher-card__orcid-link"
              title={`Ver ficha ORCID ${orcidId}`}
              onClick={(e) => e.stopPropagation()}
            >
              ORCID
            </a>
          ) : (
            <span className="chip chip--no-orcid">No ORCID</span>
          )}
          <span className="researcher-card__metrics">
            h={hIndex} · {pubCount} pub
          </span>
        </div>
      </div>
    </div>
  );
});

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
            <ResearcherCard
              key={r.o || `${r.f}-${r.l}-${i}`}
              researcher={r}
              areaFilter={areaFilter}
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
