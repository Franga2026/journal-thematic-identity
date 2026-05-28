import { useState, memo } from 'react';
import { TYPE_ES } from '../../utils/constants';
import { stripTags } from '../../utils/helpers';
import type { Work } from '../../shared/types';

interface Props { w: Work; compact?: boolean; }

const WorkCard = memo(function WorkCard({ w, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  if (!w) return null;

  const title = stripTags(w.t) || 'Sin título';
  const year = w.y || '';
  const source = w.s || '';
  const type = TYPE_ES[w.tp as keyof typeof TYPE_ES] || w.tp || '';
  const cites = w.c || 0;
  const authors = w.a || [];
  const doiUrl = w.d || '';
  const oaUrl = w.ou || '';
  const rawUrl = w.u || '';
  const doiLink = doiUrl ? (doiUrl.startsWith('http') ? doiUrl : `https://doi.org/${doiUrl}`) : '';
  const scholarUrl = title !== 'Sin título' ? `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}` : '';
  const anyUrl = oaUrl || doiLink || rawUrl || scholarUrl;
  const hasImpact = w.impact != null && w.impact > 0;
  const maxA = compact ? 3 : 4;
  const visibleA = authors.slice(0, maxA);
  const moreA = authors.length > maxA ? authors.length - maxA : 0;

  return (
    <div className={`work-card ${compact ? 'work-card__compact' : 'work-card__full'}`}>
      <div onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }}>
        <div className={`work-card__title ${compact ? 'work-card__title--compact' : ''}`}>{title}</div>
        <div className="work-card__meta">
          {year && <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>{year}</span>}
          {source && <span> · <em>{source}</em></span>}
          {type && <span> · {type}</span>}
        </div>
        {authors.length > 0 && (
          <div style={{ fontSize: compact ? 9 : 10, color: '#888', marginBottom: 6 }}>
            {visibleA.join(', ')}{moreA > 0 ? ` +${moreA} más` : ''}
          </div>
        )}
      </div>
      <div className="work-card__badges">
        {w.qi && <span className="badge badge--sm" style={{ background: w.qc || '#888', color: '#fff' }}>{w.qi}</span>}
        {w.oa && <span className="badge badge--sm badge--oa">OA</span>}
        {hasImpact && <span className="badge badge--sm badge--impact">⚡{w.impact!.toFixed(1)}</span>}
        <span className={`badge badge--sm ${cites > 0 ? 'badge--cites' : ''}`}>{cites} citas</span>
        {w.field && <span className="badge badge--sm badge--field">{w.field}</span>}
        {anyUrl && (
          <a href={anyUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
            className="btn" style={{ marginLeft: 'auto', background: w.oa ? 'var(--green-600)' : 'var(--blue-800)', color: '#fff', padding: compact ? '3px 10px' : '5px 14px', fontSize: compact ? 10 : 11 }}>
            {w.oa ? '📖 Leer' : '🔗 Acceder'}
          </a>
        )}
      </div>
    </div>
  );
});

export default WorkCard;
