import { memo, type SyntheticEvent } from 'react';
import type { Researcher } from '../../shared/types';
import { getAuthorOA } from '../../utils/dataProcessing';
import { getColor, getInitials, shortDept, cleanOrcid } from '../../utils/helpers';
import { getOrcidRecordUrl } from '../../utils/researcherProfile';

export interface ResearcherProfileCardProps {
  researcher: Researcher;
  onClick: (r: Researcher) => void;
  /** Oculta pie ORCID / h-index (p. ej. panel coautor). */
  compact?: boolean;
}

const ResearcherProfileCard = memo(function ResearcherProfileCard({
  researcher: r,
  onClick,
  compact = false,
}: ResearcherProfileCardProps) {
  const c = getColor((r.f || '') + (r.l || ''));
  const oa = getAuthorOA(r);
  const fullName = `${r.f || ''} ${r.l || ''}`.trim() || 'Sin nombre';
  const position = r.t?.trim() || 'Sin cargo';
  const deptName = (r.dp || [])[0]?.d;
  const discipline = deptName ? shortDept(deptName) : 'Sin unidad';
  const orcidId = cleanOrcid(r.o);
  const hasOrcid = Boolean(orcidId);
  const orcidUrl = getOrcidRecordUrl(r.o);
  const hIndex = oa?.h_index ?? null; // null = no lo encontramos en OpenAlex

  const handlePhotoError = (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.style.display = 'none';
    const fallback = img.nextElementSibling as HTMLElement | null;
    if (fallback) fallback.style.display = 'flex';
  };

  return (
    <div
      className={`card card--elevated researcher-card${compact ? ' researcher-card--compact' : ''}`}
      onClick={() => onClick(r)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(r);
        }
      }}
    >
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
        <div className="researcher-card__name" title={fullName}>
          {fullName}
        </div>
        <div className="researcher-card__title" title={position}>
          {position}
        </div>
        <div className="researcher-card__dept" title={deptName || discipline}>
          {discipline}
        </div>
        {!compact && (
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
            {hIndex !== null ? (
              <span className="researcher-card__metrics">h={hIndex}</span>
            ) : (
              <span className="researcher-card__nodata">sin datos</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default ResearcherProfileCard;
