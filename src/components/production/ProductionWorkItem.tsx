import { memo } from 'react';
import { TYPE_ES } from '../../utils/constants';
import { getWorkAccessUrl } from '../../utils/workAccess';
import { stripTags } from '../../utils/helpers';
import type { Work } from '../../shared/types';
import { getSourceAccess } from '../../services/sources/sourceAccess';
import WorkCitationPanel from '../cards/WorkCitationPanel';

interface ProductionWorkItemProps {
  work: Work;
}

function formatAuthors(authors: string[] | undefined, max = 3): string {
  if (!authors?.length) return 'Sin autores';
  const head = authors.slice(0, max).join(', ');
  const rest = authors.length > max ? ', et al.' : '';
  return head + rest;
}

function workUrl(w: Work): string {
  return getWorkAccessUrl(w) || '';
}

function hasPdf(w: Work): boolean {
  const u = (w.ou || w.u || '').toLowerCase();
  return Boolean(u && (u.includes('.pdf') || u.includes('/pdf')));
}

const ProductionWorkItem = memo(function ProductionWorkItem({ work: w }: ProductionWorkItemProps) {
  if (!w) return null;

  const title = stripTags(w.t) || 'Sin título';
  const year = w.y != null ? String(w.y) : '';
  const source = w.s?.trim() || 'Sin fuente';
  const type = TYPE_ES[w.tp as keyof typeof TYPE_ES] || w.tp || 'Sin tipo';
  const cites = w.c ?? 0;
  const authors = formatAuthors(w.a);
  const url = workUrl(w);
  const pdf = hasPdf(w);
  const sourceAccess = getSourceAccess(w.s);

  const metaLine = [year, authors, source].filter(Boolean).join(' · ');
  const tertiaryParts = [
    sourceAccess === 'oa' ? '🔓 Acceso UTA · OA' : sourceAccess === 'subscribed' ? '📚 Acceso UTA' : null,
    `${cites} ${cites === 1 ? 'cita' : 'citas'}`,
    type,
    w.oa ? 'Open Access' : null,
    pdf ? 'PDF' : null,
  ].filter(Boolean);

  return (
    <article className="production-work">
      <div className="production-work__select" aria-hidden>
        <span className="production-work__checkbox" />
      </div>
      <div className="production-work__body">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="production-work__title production-work__title--link"
          >
            {title}
          </a>
        ) : (
          <h3 className="production-work__title">{title}</h3>
        )}
        <p className="production-work__line production-work__line--meta">{metaLine}</p>
        <p className="production-work__line production-work__line--tags">
          {tertiaryParts.map((part, i) => (
            <span key={part}>
              {i > 0 && <span className="production-work__sep"> · </span>}
              {part === 'Open Access' && <span className="production-work__oa">Open Access</span>}
              {part === 'PDF' && <span className="production-work__pdf">PDF</span>}
              {part !== 'Open Access' && part !== 'PDF' && <span>{part}</span>}
            </span>
          ))}
        </p>
        {(w.field || w.topic) && (
          <p className="production-work__topics">
            {w.topic || w.field}
            {w.subfield && w.subfield !== w.field ? ` · ${w.subfield}` : ''}
          </p>
        )}
        <div className="production-work__actions">
          <WorkCitationPanel work={w} compact />
        </div>
      </div>
    </article>
  );
});

export default ProductionWorkItem;
