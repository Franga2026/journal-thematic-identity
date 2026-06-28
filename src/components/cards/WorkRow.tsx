import { memo, type MouseEvent } from 'react';
import { stripTags } from '../../utils/helpers';
import { getWorkAccessUrl, normDoiUrl } from '../../utils/workAccess';
import { topicLineEs } from '../../utils/fieldEs';
import {
  fmtFwci,
  getWorkOpenAlexCitations,
  getWorkOpenAlexFwci,
} from '../../utils/workMetrics';
import { getUtaLinks } from '../../utils/utaAuthorLinks';
import { summarizeWork } from '../../api/aiApi';
import type { WorkSummaryStructured } from '../../services/ai/types';
import WorkCitationPanel from './WorkCitationPanel';
import AISummaryButton from '../ai/AISummaryButton';
import type { Work } from '../../shared/types';
import type { WorkCardVariant } from './WorkCard';

function formatAuthors(authors: string[], max = 2): string {
  if (!authors.length) return '';
  const visible = authors.slice(0, max);
  const more = authors.length - max;
  const base = visible.join(', ');
  return more > 0 ? `${base} +${more}` : base;
}

function normalizeWorkQi(qi?: string): string | null {
  if (!qi) return null;
  return /^Q/i.test(qi) ? qi.toUpperCase() : `Q${qi}`;
}

function quartileBadgeClass(qNorm: string | null): string {
  if (qNorm === 'Q1') return 'work-row__badge--q1';
  if (qNorm === 'Q2') return 'work-row__badge--q2';
  if (qNorm === 'Q3') return 'work-row__badge--q3';
  if (qNorm === 'Q4') return 'work-row__badge--q4';
  return 'work-row__badge--q-none';
}

function WorkAiSummaryBody({ data }: { data: WorkSummaryStructured }) {
  return (
    <div className="ai-work-summary">
      <p><strong>Resumen:</strong> {data.resumen}</p>
      <p><strong>Aporte:</strong> {data.aporte_principal}</p>
      <p><strong>Metodología:</strong> {data.metodologia_probable}</p>
      <p><strong>Aplicación:</strong> {data.aplicacion_practica}</p>
      {data.ods_relacionados?.length > 0 && (
        <p><strong>ODS:</strong> {data.ods_relacionados.join(' · ')}</p>
      )}
    </div>
  );
}

interface WorkRowProps {
  w: Work;
  variant?: WorkCardVariant;
  rowId: string;
  expanded: boolean;
  onToggle: (rowId: string) => void;
}

const WorkRow = memo(function WorkRow({
  w,
  variant = 'production',
  rowId,
  expanded,
  onToggle,
}: WorkRowProps) {
  const title = stripTags(w.t) || 'Sin título';
  const year = w.y != null ? String(w.y) : '—';
  const journal = w.s?.trim() || '';
  const authors = w.a || [];
  const area = topicLineEs(w);
  const cites = getWorkOpenAlexCitations(w);
  const fwci = getWorkOpenAlexFwci(w);
  const accessUrl = getWorkAccessUrl(w);
  const doiUrl = normDoiUrl(w.d);

  const isCoauthorLite =
    variant === 'coauthor'
    && !getUtaLinks(w).length
    && !w.qi
    && w.impact == null
    && w.fwci == null
    && !(w.sdgs || []).length;

  const metaParts = [journal, formatAuthors(authors, 2), area].filter(Boolean);
  const fwciLabel = fmtFwci(fwci) ?? '—';
  const fwciClass =
    fwci != null && fwci >= 2
      ? 'work-row__badge--fwci-high'
      : 'work-row__badge--fwci-low';
  const qNorm = normalizeWorkQi(w.qi);
  const quartileLabel = qNorm ?? '—';

  const handleRowClick = () => onToggle(rowId);

  const handleAccessClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!accessUrl) return;
    window.open(accessUrl, '_blank', 'noopener,noreferrer');
  };

  const stopPropagation = (e: MouseEvent) => e.stopPropagation();

  return (
    <div className="work-row-wrap">
      <div
        className={`work-row${isCoauthorLite ? ' work-row--lite' : ''}${expanded ? ' work-row--expanded' : ''}`}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRowClick();
          }
        }}
      >
        <span className="work-row__year">{year}</span>
        <div className="work-row__main">
          <div className="work-row__title">{title}</div>
          {metaParts.length > 0 && (
            <div className="work-row__meta">{metaParts.join(' · ')}</div>
          )}
        </div>
        <div className="work-row__metrics">
          <span className={`work-row__badge ${fwciClass}`} title="FWCI">
            {fwciLabel}
          </span>
          <span className="work-row__badge work-row__badge--cites" title="Citas">
            {cites.toLocaleString('es')}
          </span>
          <span
            className={`work-row__badge ${quartileBadgeClass(qNorm)}`}
            title="Cuartil SJR"
          >
            {quartileLabel}
          </span>
          {accessUrl && (
            <button
              type="button"
              className="work-row__access"
              onClick={handleAccessClick}
              aria-label="Acceder a la obra"
              title="Acceder"
            >
              ↗
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="work-row__expand" onClick={stopPropagation}>
          {authors.length > 0 && (
            <p className="work-row__expand-line">
              <strong>Autores:</strong> {authors.join(', ')}
            </p>
          )}
          {doiUrl && (
            <p className="work-row__expand-line">
              <strong>DOI:</strong>{' '}
              <a
                href={doiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="work-row__expand-doi"
              >
                {doiUrl.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}
              </a>
            </p>
          )}
          <div className="work-card__foot work-row__expand-actions">
            <WorkCitationPanel work={w} buttonClassName="work-card__btn" />
            <AISummaryButton
              label="Resumen IA"
              panelTitle="Resumen IA de la publicación"
              buttonClassName="work-card__btn"
              showIcon
              fetchAnalysis={() => summarizeWork(w)}
              renderStructured={(data) => <WorkAiSummaryBody data={data} />}
            />
            <button
              type="button"
              disabled={!accessUrl}
              title={accessUrl ? undefined : 'Sin enlace de acceso disponible'}
              onClick={handleAccessClick}
              className="work-card__btn work-card__btn--access"
            >
              Acceder
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default WorkRow;
