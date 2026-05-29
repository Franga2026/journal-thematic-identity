import { useState, memo, useMemo, type MouseEvent } from 'react';
import { TYPE_ES } from '../../utils/constants';
import { stripTags } from '../../utils/helpers';
import { getWorkAccessUrl, getWorkNavigationUrl } from '../../utils/workAccess';
import { getData } from '../../utils/dataProcessing';
import { findResearcherByProfileId } from '../../utils/researcherProfile';
import { useOpenResearcherProfile } from '../../app/hooks/useOpenResearcherProfile';
import { getSourceInfo } from '../../services/sources/sourceAccess';
import WorkCitationPanel from './WorkCitationPanel';
import AISummaryButton from '../ai/AISummaryButton';
import { summarizeWork } from '../../api/aiApi';
import type { WorkSummaryStructured } from '../../services/ai/types';
import type { Work } from '../../shared/types';

interface Props { w: Work; compact?: boolean; }

const WorkCard = memo(function WorkCard({ w, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const { openLocalResearcherProfile, openProfileById } = useOpenResearcherProfile();

  if (!w) return null;

  const title = stripTags(w.t) || 'Sin título';
  const year = w.y || '';
  const source = w.s || '';
  const type = TYPE_ES[w.tp as keyof typeof TYPE_ES] || w.tp || '';
  const cites = w.c || 0;
  const authors = w.a || [];
  const accessUrl = getWorkAccessUrl(w);
  const navUrl = getWorkNavigationUrl(w);
  const hasDirectAccess = Boolean(accessUrl);
  const hasImpact = w.impact != null && w.impact > 0;
  const maxA = compact ? 3 : 4;
  const visibleA = authors.slice(0, maxA);
  const moreA = authors.length > maxA ? authors.length - maxA : 0;

  // ─── Investigadores UTA vinculados ───
  const utaLinked = useMemo(() => {
    const ids: string[] = (w as any).autores_uta || [];
    if (!ids.length) return [];
    const catalog = getData();
    return ids
      .map((utaId) => {
        const r = findResearcherByProfileId(catalog, utaId);
        if (!r) return null;
        return { id: utaId, name: `${r.f || ''} ${r.l || ''}`.trim(), researcher: r };
      })
      .filter(Boolean) as { id: string; name: string; researcher: any }[];
  }, [w]);

  // ─── Acceso ScienceDirect ───
  const srcInfo = getSourceInfo(w.s);

  const handleAccessClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!navUrl) return;
    window.open(navUrl, '_blank', 'noopener,noreferrer');
  };

  const handleUtaAuthorClick = (e: MouseEvent, researcher: any) => {
    e.stopPropagation();
    openLocalResearcherProfile(researcher);
  };

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

      {/* ─── Investigadores UTA vinculados ─── */}
      {utaLinked.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {utaLinked.map((uta) => (
            <button
              key={uta.id}
              type="button"
              onClick={(e) => handleUtaAuthorClick(e, uta.researcher)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: compact ? '2px 6px' : '3px 8px',
                fontSize: compact ? 9 : 10, fontWeight: 600,
                background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                color: 'var(--blue-800)', border: '1px solid #bfdbfe',
                borderRadius: 6, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #dbeafe, #bfdbfe)';
                e.currentTarget.style.borderColor = '#93c5fd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #eff6ff, #dbeafe)';
                e.currentTarget.style.borderColor = '#bfdbfe';
              }}
              title={`Ver ficha de ${uta.name}`}
            >
              🎓 {uta.name} →
            </button>
          ))}
        </div>
      )}

      <div className="work-card__badges">
        {/* Cuartil */}
        {w.qi && <span className="badge badge--sm" style={{ background: w.qc || '#888', color: '#fff' }}>{w.qi}</span>}

        {/* Acceso ScienceDirect + Editorial */}
        {srcInfo.access === 'oa' && (
          <span className="badge badge--sm" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', fontSize: compact ? 8 : 9 }}>
            🔓 ScienceDirect · {srcInfo.publisher || 'OA'}
          </span>
        )}
        {srcInfo.access === 'subscribed' && (
          <span className="badge badge--sm" style={{ background: 'linear-gradient(135deg, #1e40af, #1e3a8a)', color: '#fff', fontSize: compact ? 8 : 9 }}>
            📚 ScienceDirect · {srcInfo.publisher || 'Elsevier'}
          </span>
        )}

        {/* OA (solo si no es ya OA vía ScienceDirect) */}
        {w.oa && srcInfo.access !== 'oa' && <span className="badge badge--sm badge--oa">OA</span>}

        {hasImpact && <span className="badge badge--sm badge--impact">⚡{w.impact!.toFixed(1)}</span>}
        <span className={`badge badge--sm ${cites > 0 ? 'badge--cites' : ''}`}>{cites} citas</span>
        {w.field && <span className="badge badge--sm badge--field">{w.field}</span>}

        {/* ODS */}
        {(w.sdgs || []).slice(0, 2).map((sdg: string, i: number) => (
          <span key={i} className="badge badge--sm" style={{ background: '#0A97D9', color: '#fff', fontSize: 8 }}>ODS · {sdg}</span>
        ))}

        <WorkCitationPanel work={w} compact={compact} />
        <AISummaryButton
          label="Resumen IA"
          panelTitle="Resumen IA de la publicación"
          compact={compact}
          fetchAnalysis={() => summarizeWork(w)}
          renderStructured={(data: WorkSummaryStructured) => (
            <div className="ai-work-summary">
              <p><strong>Resumen:</strong> {data.resumen}</p>
              <p><strong>Aporte:</strong> {data.aporte_principal}</p>
              <p><strong>Metodología:</strong> {data.metodologia_probable}</p>
              <p><strong>Aplicación:</strong> {data.aplicacion_practica}</p>
              {data.ods_relacionados?.length > 0 && (
                <p><strong>ODS:</strong> {data.ods_relacionados.join(' · ')}</p>
              )}
            </div>
          )}
        />
        <button
          type="button"
          disabled={!navUrl}
          title={navUrl ? (hasDirectAccess ? undefined : 'Búsqueda en Google Scholar') : 'Sin enlace disponible'}
          onClick={handleAccessClick}
          className="btn"
          style={{
            marginLeft: 'auto',
            background: navUrl ? (w.oa ? 'var(--green-600)' : 'var(--blue-800)') : 'var(--gray-300)',
            color: navUrl ? '#fff' : 'var(--gray-600)',
            padding: compact ? '3px 10px' : '5px 14px',
            fontSize: compact ? 10 : 11,
            cursor: navUrl ? 'pointer' : 'not-allowed',
            border: 'none',
          }}
        >
          {w.oa ? '📖 Leer' : '🔗 Acceder'}
        </button>
      </div>
    </div>
  );
});

export default WorkCard;
