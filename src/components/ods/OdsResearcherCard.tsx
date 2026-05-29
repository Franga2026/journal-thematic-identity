import { memo } from 'react';
import type { SdgRankedResearcher } from '../../shared/types/sdgResearcher';
import { getResearcherUtaId } from '../../utils/helpers';
import type { Researcher } from '../../shared/types';

interface OdsRankingCardProps {
  variant: 'ranking';
  row: SdgRankedResearcher;
  onClick: () => void;
}

interface OdsUtaCardProps {
  variant: 'uta';
  row: SdgRankedResearcher;
  researcher?: Researcher;
  onClick: () => void;
}

export type OdsResearcherCardProps = OdsRankingCardProps | OdsUtaCardProps;

const OdsResearcherCard = memo(function OdsResearcherCard(props: OdsResearcherCardProps) {
  const { row, onClick } = props;

  if (props.variant === 'uta') {
    const r = props.researcher;
    const rut = getResearcherUtaId(r || { id: row.uta_researcher_id, o: row.orcid }) || row.uta_researcher_id || '—';
    const dept = (r?.dp || [])[0]?.d || row.institution_name;
    const count = row.publications_count;
    const pubLabel = count === 1 ? 'artículo científico' : 'artículos científicos';

    return (
      <button type="button" className="ods-researcher-card ods-researcher-card--uta" onClick={onClick}>
        <div className="ods-researcher-card__body">
          <div className="ods-researcher-card__id">{rut}</div>
          <div className="ods-researcher-card__name">{row.author_name}</div>
          {dept && <div className="ods-researcher-card__sub">{dept}</div>}
          <div className="ods-researcher-card__meta ods-researcher-card__meta--highlight">
            <strong>{count.toLocaleString()}</strong> {pubLabel} en este ODS
          </div>
        </div>
        <span className="ods-researcher-card__action">Ver ficha →</span>
      </button>
    );
  }

  const isLocal = row.region_scope === 'local';

  return (
    <button
      type="button"
      className={`ods-researcher-card ${isLocal ? '' : 'ods-researcher-card--external'}`}
      onClick={onClick}
    >
      <span className="ods-researcher-card__rank">#{row.rank}</span>
      <div className="ods-researcher-card__body">
        <div className="ods-researcher-card__name">{row.author_name}</div>
        {row.institution_name && (
          <div className="ods-researcher-card__sub">
            {row.institution_name}
            {row.country_code ? ` · ${row.country_code}` : ''}
          </div>
        )}
        <div className="ods-researcher-card__meta">
          {row.publications_count} pubs ODS · {row.citations_count.toLocaleString()} citas · h
          {row.h_index_sdg} · score {row.score.toFixed(1)}
        </div>
        <div className="ods-researcher-card__links">
          {row.orcid && <span className="ods-researcher-card__link-tag">ORCID</span>}
          {!isLocal && <span className="ods-researcher-card__link-tag">OpenAlex</span>}
          {row.collaboration_score > 0 && (
            <span className="ods-researcher-card__link-tag">
              Colab. int. {(row.collaboration_score * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      <span className="ods-researcher-card__action">Ver ficha →</span>
    </button>
  );
});

export default OdsResearcherCard;
