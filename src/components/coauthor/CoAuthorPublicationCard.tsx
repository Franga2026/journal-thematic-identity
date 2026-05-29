import { memo } from 'react';
import { Link } from 'react-router-dom';
import type { Work } from '../../shared/types';
import { TYPE_ES } from '../../utils/constants';
import { SDG_ES } from '../../utils/constants';
import WorkCitationPanel from '../cards/WorkCitationPanel';
import AISummaryButton from '../ai/AISummaryButton';
import { summarizeWork } from '../../api/aiApi';
import type { WorkSummaryStructured } from '../../services/ai/types';
import {
  formatDoiLink,
  workPublisherLabel,
  workTitlePlain,
  workTypeLabel,
  firstSdgRoute,
} from '../../utils/coAuthorProfileView';
import { getWorkAccessUrl, getWorkNavigationUrl } from '../../utils/workAccess';
import { getSourceAccess } from '../../services/sources/sourceAccess';

function parseOpenAlexId(id?: string): string {
  if (!id) return '';
  return id.replace(/^https?:\/\/openalex\.org\//i, '').trim();
}

function openAlexWorkUrl(work: Work): string | null {
  const id = parseOpenAlexId((work as Work & { openalex_id?: string }).openalex_id);
  if (id) return `https://openalex.org/${id}`;
  const nav = getWorkNavigationUrl(work);
  if (nav?.includes('openalex.org')) return nav;
  return null;
}

interface CoAuthorPublicationCardProps {
  work: Work;
  authorHIndex?: number;
}

const CoAuthorPublicationCard = memo(function CoAuthorPublicationCard({
  work,
  authorHIndex,
}: CoAuthorPublicationCardProps) {
  const title = workTitlePlain(work);
  const year = work.y ? String(work.y) : '';
  const source = workPublisherLabel(work);
  const type = TYPE_ES[work.tp as keyof typeof TYPE_ES] || workTypeLabel(work);
  const authors = work.a || [];
  const visible = authors.slice(0, 3);
  const more = authors.length > 3 ? authors.length - 3 : 0;
  const accessUrl = getWorkAccessUrl(work);
  const openAlexUrl = openAlexWorkUrl(work);
  const doiUrl = formatDoiLink(work.d);
  const sdg = (work.sdgs || [])[0];
  const sdgRoute = firstSdgRoute(sdg);
  const sdgLabel = sdg ? SDG_ES[sdg as keyof typeof SDG_ES] || sdg : null;
  const sourceAccess = getSourceAccess(work.s);
  const pubInitials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);

  return (
    <article className="coauthor-pub-card">
      <div className="coauthor-pub-card__main">
        <div className="coauthor-pub-card__thumb" aria-hidden>
          {pubInitials || '📄'}
        </div>
        <div className="coauthor-pub-card__body">
          <h3 className="coauthor-pub-card__title">{title}</h3>
          <p className="coauthor-pub-card__meta">
            {[year, source, type].filter(Boolean).join(' · ')}
          </p>
          {authors.length > 0 && (
            <p className="coauthor-pub-card__authors">
              {visible.join(', ')}
              {more > 0 ? ` + ${more} más` : ''}
            </p>
          )}
          <div className="coauthor-pub-card__tags">
            {sourceAccess === 'oa' && (
              <span className="coauthor-pub-card__tag" style={{ background: '#dcfce7', color: '#16a34a' }}>🔓 Acceso UTA · OA</span>
            )}
            {sourceAccess === 'subscribed' && (
              <span className="coauthor-pub-card__tag" style={{ background: '#dbeafe', color: '#1d4ed8' }}>📚 Acceso UTA</span>
            )}
            {work.oa && (
              <span className="coauthor-pub-card__tag coauthor-pub-card__tag--oa">Acceso abierto</span>
            )}
            <span className="coauthor-pub-card__tag coauthor-pub-card__tag--cites">
              {(work.c ?? 0).toLocaleString()} citas
            </span>
            {work.field && (
              <span className="coauthor-pub-card__tag coauthor-pub-card__tag--field">{work.field}</span>
            )}
            {sdgLabel && sdgRoute && (
              <Link to={sdgRoute} className="coauthor-pub-card__tag coauthor-pub-card__tag--sdg">
                {sdgLabel}
              </Link>
            )}
            {(work.sdgs || []).length > 0 && (
              <span className="coauthor-pub-card__tag coauthor-pub-card__tag--ods">ODS</span>
            )}
          </div>
          <div className="coauthor-pub-card__actions">
            <WorkCitationPanel work={work} compact />
            <AISummaryButton
              label="Resumen IA"
              panelTitle="Resumen IA de la publicación"
              compact
              fetchAnalysis={() => summarizeWork(work)}
              renderStructured={(data: WorkSummaryStructured) => (
                <div className="ai-work-summary">
                  <p><strong>Resumen:</strong> {data.resumen}</p>
                  <p><strong>Aporte:</strong> {data.aporte_principal}</p>
                </div>
              )}
            />
            {openAlexUrl && (
              <a
                href={openAlexUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="coauthor-pub-card__btn coauthor-pub-card__btn--openalex"
              >
                Ver en OpenAlex
              </a>
            )}
            {accessUrl && (
              <a
                href={accessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="coauthor-pub-card__btn coauthor-pub-card__btn--pdf"
              >
                {work.oa ? 'PDF / Leer' : 'Acceder'}
              </a>
            )}
          </div>
        </div>
      </div>
      <aside className="coauthor-pub-card__impact">
        <div className="coauthor-pub-card__impact-row">
          <span>Citas totales</span>
          <strong>{(work.c ?? 0).toLocaleString()}</strong>
        </div>
        {authorHIndex != null && (
          <div className="coauthor-pub-card__impact-row">
            <span>H-index del autor</span>
            <strong>{authorHIndex}</strong>
          </div>
        )}
        <div className="coauthor-pub-card__impact-row">
          <span>Fuente</span>
          <strong>{source}</strong>
        </div>
        {doiUrl && (
          <div className="coauthor-pub-card__impact-row coauthor-pub-card__impact-row--doi">
            <span>DOI</span>
            <a href={doiUrl} target="_blank" rel="noopener noreferrer">
              {work.d?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') || work.d}
            </a>
          </div>
        )}
      </aside>
    </article>
  );
});

export default CoAuthorPublicationCard;
