import { memo, useState, type CSSProperties, type SyntheticEvent } from 'react';
import type { SdgRankedResearcher } from '../../shared/types/sdgResearcher';
import type { Researcher, Work } from '../../shared/types';
import { getAuthorOA } from '../../utils/dataProcessing';
import { getColor, getInitials, shortDept, cleanOrcid } from '../../utils/helpers';
import { getOrcidRecordUrl } from '../../utils/researcherProfile';
import OdsWorksModal from './OdsWorksModal';

interface OdsRankingCardProps {
  variant: 'ranking';
  row: SdgRankedResearcher;
  /** Obras del autor externo en este ODS (de getOA().authors[...].works). */
  odsWorks?: Work[];
  accent?: string;
  onClick: () => void;
}

interface OdsUtaCardProps {
  variant: 'uta';
  row: SdgRankedResearcher;
  researcher?: Researcher;
  /** Obras de ESTE investigador UTA en ESTE ODS (de autores_uta). */
  odsWorks?: Work[];
  accent?: string;
  onClick: () => void;
}

export type OdsResearcherCardProps = OdsRankingCardProps | OdsUtaCardProps;

const BRAND_BLUE = '#1e3a8a';

function initialsFromName(name?: string): string {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

function handlePhotoError(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  img.style.display = 'none';
  const fallback = img.nextElementSibling as HTMLElement | null;
  if (fallback) fallback.style.display = 'flex';
}

const odsBadgeStyle = (accent: string, clickable: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  background: `${accent}1a`,
  color: accent,
  fontWeight: 700,
  fontSize: 12,
  padding: '3px 9px',
  borderRadius: 999,
  border: 'none',
  cursor: clickable ? 'pointer' : 'default',
  fontFamily: 'inherit',
});

const OdsResearcherCard = memo(function OdsResearcherCard(props: OdsResearcherCardProps) {
  const { row, onClick } = props;
  const accent = props.accent || BRAND_BLUE;
  const [worksModalOpen, setWorksModalOpen] = useState(false);

  const odsWorks = props.odsWorks || [];
  const canOpenWorks = odsWorks.length > 0;
  const count = row.publications_count;
  const badgeLabel =
    props.variant === 'uta'
      ? `${count.toLocaleString()} ${count === 1 ? 'artículo' : 'artículos'} en este ODS`
      : `${count.toLocaleString()} ${count === 1 ? 'publicación' : 'publicaciones'} en este ODS`;

  const openWorksModal = (e: SyntheticEvent) => {
    if (!canOpenWorks) return;
    e.stopPropagation();
    setWorksModalOpen(true);
  };

  const odsBadge = (
    <button
      type="button"
      style={odsBadgeStyle(accent, canOpenWorks)}
      title={canOpenWorks ? 'Ver publicaciones del ODS' : undefined}
      onClick={openWorksModal}
    >
      {badgeLabel}
    </button>
  );

  // ───────────── Variante UTA ─────────────
  if (props.variant === 'uta') {
    const r = props.researcher;
    const c = getColor(r ? (r.f || '') + (r.l || '') : row.author_name);
    const oa = r ? getAuthorOA(r) : null;
    const fullName = (r ? `${r.f || ''} ${r.l || ''}`.trim() : '') || row.author_name || 'Sin nombre';
    const position = r?.t?.trim() || 'Sin cargo';
    const deptName = (r?.dp || [])[0]?.d;
    const discipline = deptName ? shortDept(deptName) : row.institution_name || 'Sin unidad';
    const orcidId = cleanOrcid(r?.o) || row.orcid;
    const hasOrcid = Boolean(orcidId);
    const orcidUrl = r ? getOrcidRecordUrl(r.o) : '';
    const hIndex = oa?.h_index ?? 0;

    return (
      <>
        <div className="card card--elevated researcher-card" onClick={onClick}>
          <div className="researcher-card__avatar-slot" aria-hidden>
            {r?.ph ? (
              <>
                <img src={`/photos/${r.ph}`} alt="" className="researcher-card__avatar" onError={handlePhotoError} loading="lazy" />
                <div className="researcher-card__avatar-placeholder researcher-card__avatar-placeholder--fallback" style={{ background: c, display: 'none' }}>
                  {getInitials(r.f, r.l)}
                </div>
              </>
            ) : (
              <div className="researcher-card__avatar-placeholder" style={{ background: c }}>
                {r ? getInitials(r.f, r.l) : initialsFromName(row.author_name)}
              </div>
            )}
          </div>

          <div className="researcher-card__body">
            <div className="researcher-card__name" title={fullName}>{fullName}</div>
            <div className="researcher-card__title" title={position}>{position}</div>
            <div className="researcher-card__dept" title={deptName || discipline}>{discipline}</div>

            <div className="researcher-card__ods" style={{ marginTop: 6 }}>
              {odsBadge}
            </div>

            <div className="researcher-card__footer">
              {hasOrcid ? (
                orcidUrl ? (
                  <a href={orcidUrl} target="_blank" rel="noopener noreferrer" className="chip chip--orcid researcher-card__orcid-link" title={`Ver ficha ORCID ${orcidId}`} onClick={(e) => e.stopPropagation()}>
                    ORCID
                  </a>
                ) : (
                  <span className="chip chip--orcid">ORCID</span>
                )
              ) : (
                <span className="chip chip--no-orcid">No ORCID</span>
              )}
              <span className="researcher-card__metrics">h={hIndex}</span>
            </div>
          </div>
        </div>

        <OdsWorksModal
          open={worksModalOpen}
          onClose={() => setWorksModalOpen(false)}
          works={odsWorks}
          name={fullName}
          role={position}
          unit={discipline}
          badgeLabel={badgeLabel}
        />
      </>
    );
  }

  // ───────────── Variante ranking (Iberoamérica / Global) ─────────────
  const isLocal = row.region_scope === 'local';
  const c = getColor(row.author_name);
  const institutionLine = row.institution_name
    ? `${row.institution_name}${row.country_code ? ` · ${row.country_code}` : ''}`
    : undefined;

  return (
    <>
      <div className="card card--elevated researcher-card" onClick={onClick}>
        <div className="researcher-card__avatar-slot" aria-hidden>
          <div className="researcher-card__avatar-placeholder" style={{ background: c }}>
            {initialsFromName(row.author_name)}
          </div>
        </div>

        <div className="researcher-card__body">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div className="researcher-card__name" title={row.author_name}>{row.author_name}</div>
            <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', background: accent, color: '#fff', fontWeight: 800, fontSize: 12, padding: '3px 9px', borderRadius: 999 }} title={`Ranking #${row.rank}`}>
              #{row.rank}
            </span>
          </div>

          {institutionLine && (
            <div className="researcher-card__dept" title={row.institution_name}>
              {institutionLine}
            </div>
          )}

          <div className="researcher-card__ods" style={{ marginTop: 6 }}>
            {odsBadge}
          </div>

          <div className="researcher-card__footer" style={{ flexWrap: 'wrap', gap: 6 }}>
            <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
              {row.orcid && <span className="chip chip--orcid">ORCID</span>}
              {!isLocal && <span className="ods-researcher-card__link-tag">OpenAlex</span>}
              {row.collaboration_score > 0 && (
                <span className="ods-researcher-card__link-tag">Colab. int. {(row.collaboration_score * 100).toFixed(0)}%</span>
              )}
            </span>
            <span className="researcher-card__metrics">
              {row.citations_count.toLocaleString()} citas · h{row.h_index_sdg} · score {row.score.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      <OdsWorksModal
        open={worksModalOpen}
        onClose={() => setWorksModalOpen(false)}
        works={odsWorks}
        name={row.author_name}
        unit={institutionLine}
        badgeLabel={badgeLabel}
      />
    </>
  );
});

export default OdsResearcherCard;
