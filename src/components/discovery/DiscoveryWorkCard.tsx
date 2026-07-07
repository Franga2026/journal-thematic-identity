import { memo, useEffect, useState } from 'react';
import { getWorkAccessUrl } from '../../utils/workAccess';
import type { WorkResult } from '../../services/discovery/universalSearch';
import { workResultToWork, displayableChipLabel } from '../../services/discovery/universalSearch';
import WorkCitationPanel from '../cards/WorkCitationPanel';
import { fetchDataCiteUsage, type DataCiteUsage } from '../../utils/datasetUsage';
import { fetchFairScores, type FairScores } from '../../utils/datasetFair';

const OA_LABELS: Record<string, string> = {
  gold: 'Oro', green: 'Verde', hybrid: 'Híbrido', bronze: 'Bronce',
  diamond: 'Diamante', closed: 'Cerrado',
};
const OA_COLORS: Record<string, string> = {
  gold: '#EF9F27', green: '#639922', hybrid: '#378ADD',
  bronze: '#B4B2A9', diamond: '#3FA7A2', closed: '#5F5E5A',
};
const TYPE_BADGE: Record<string, { label: string; style: string }> = {
  article: { label: 'ARTÍCULO', style: 'dw-badge--type-article' },
  book: { label: 'LIBRO', style: 'dw-badge--type-book' },
  'book-chapter': { label: 'CAPÍTULO', style: 'dw-badge--type-chapter' },
  review: { label: 'REVISIÓN', style: 'dw-badge--type-article' },
  dataset: { label: 'DATASET', style: 'dw-badge--type-dataset' },
  dissertation: { label: 'TESIS', style: 'dw-badge--type-thesis' },
  preprint: { label: 'PREPRINT', style: 'dw-badge--type-preprint' },
};

function DbIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className="dw-db-icon">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

function openAlexWorkUrl(openalexId?: string | null): string | null {
  if (!openalexId?.trim()) return null;
  const id = openalexId.replace(/^https?:\/\/openalex\.org\//i, '').replace(/^works\//i, '').trim();
  return id ? `https://openalex.org/works/${id}` : null;
}

function DwMetric({
  label,
  value,
  href,
  title,
}: {
  label: string;
  value: string;
  href?: string | null;
  title?: string;
}) {
  const inner = (
    <>
      {label} <strong>{value}</strong>
    </>
  );
  if (!href) {
    return <span className="dw-card__metric" title={title}>{inner}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="dw-card__metric dw-card__metric--link"
      title={title ?? `Ver ${label} en OpenAlex`}
      aria-label={`Ver ${label} en OpenAlex`}
    >
      {inner}
    </a>
  );
}

function fairTone(score: number): string {
  if (score >= 75) return 'dw-fair__val--high';
  if (score >= 50) return 'dw-fair__val--mid';
  return 'dw-fair__val--low';
}

function FairStrip({ scores }: { scores: FairScores }) {
  const items = [
    { key: 'F', label: 'Findable', value: scores.findable },
    { key: 'A', label: 'Accessible', value: scores.accessible },
    { key: 'I', label: 'Interoperable', value: scores.interoperable },
    { key: 'R', label: 'Reusable', value: scores.reusable },
  ] as const;

  return (
    <div className="dw-fair" title="FAIR (F-UJI · fairdata.ai)">
      <span className="dw-fair__label">FAIR</span>
      {items.map(({ key, label, value }) => (
        <span key={key} className="dw-fair__pill" title={`${label}: ${value}%`}>
          {key} <strong className={fairTone(value)}>{value}</strong>
        </span>
      ))}
      <span className={`dw-fair__overall ${fairTone(scores.overall)}`}>
        {scores.overall}%
      </span>
    </div>
  );
}

const Q_COLORS: Record<string, string> = {
  Q1: '#15803D', Q2: '#CA8A04', Q3: '#EA580C', Q4: '#888888',
};

const DiscoveryWorkCard = memo(function DiscoveryWorkCard({ r }: { r: WorkResult }) {
  const isDataset = r.type === 'dataset';
  const isChapter = r.type === 'book-chapter';
  const isBook = r.type === 'book';
  const isJournalArticle = r.is_journal_article ?? (r.type === 'article' || r.type === 'review');
  const typeInfo = TYPE_BADGE[r.type || ''] || {
    label: (r.type || 'OBRA').toUpperCase(),
    style: 'dw-badge--type-other',
  };
  const w = workResultToWork(r);
  const accessUrl = getWorkAccessUrl(w);
  const authors = (r.authors || []).map((a) => a.name);
  const visibleAuthors = authors.slice(0, 3).join(', ');
  const moreAuthors = authors.length > 3 ? ` +${authors.length - 3}` : '';
  const oaKey = r.oa_status || (r.is_oa ? 'gold' : 'closed');
  const oaLabel = OA_LABELS[oaKey] || oaKey;
  const oaColor = OA_COLORS[oaKey] || '#999';
  const fwci = r.fwci != null ? r.fwci.toFixed(2) : '—';
  const [usage, setUsage] = useState<DataCiteUsage | null>(null);
  const [fair, setFair] = useState<FairScores | null>(null);

  useEffect(() => {
    if (!isDataset || !r.doi) {
      setUsage(null);
      setFair(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetchDataCiteUsage(r.doi),
      fetchFairScores(r.doi),
    ]).then(([usageResult, fairResult]) => {
      if (!cancelled) {
        setUsage(usageResult);
        setFair(fairResult);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isDataset, r.doi]);

  const usesCount = isDataset && usage
    ? usage.viewCount + usage.downloadCount
    : (r.cited_by_count ?? 0);
  const usesLabel = isDataset ? 'USOS' : 'CITAS';
  const usesDisplay = usesCount.toLocaleString('es-CL');
  const titleText = stripTags(r.title);
  const oaWorkUrl = openAlexWorkUrl(r.openalex_id);
  const linkCites = usesLabel === 'CITAS' && oaWorkUrl;
  const publisherLabel = displayableChipLabel(r.publisher);
  const linkedCount = r.linked_datasets_count ?? r.linked_datasets?.length ?? 0;
  const primaryLinked = r.linked_datasets?.[0];
  const linkedUrl = primaryLinked?.url
    || (primaryLinked?.openalex_id ? `https://openalex.org/works/${primaryLinked.openalex_id}` : null);
  const linkedLabel = linkedCount === 1
    ? 'Dataset vinculado'
    : linkedCount > 1
      ? `${linkedCount} datasets`
      : '';

  return (
    <article className={`dw-card${isDataset ? ' dw-card--dataset' : ''}`}>
      <div className="dw-card__badges">
        <span className={`dw-badge ${typeInfo.style}`}>
          {isDataset && <DbIcon size={9} />}
          {typeInfo.label}
        </span>
        {r.is_oa && oaKey !== 'closed' && (
          <span className="dw-badge" style={{ background: oaColor, color: '#fff' }}>
            {oaLabel}
          </span>
        )}
        {!isDataset && isJournalArticle && r.quartile && (
          <span
            className="dw-badge dw-badge--quartile"
            style={{ background: Q_COLORS[r.quartile] || '#64748b', color: '#fff' }}
          >
            SJR {r.quartile}
          </span>
        )}
        {!isDataset && isJournalArticle && !r.quartile && r.journal && (
          <span className="dw-badge dw-badge--no-quartile">sin cuartil</span>
        )}
        {publisherLabel && (
          <span className="dw-badge dw-badge--pub">{publisherLabel}</span>
        )}
        {!isDataset && linkedCount > 0 && linkedUrl && (
          <a
            href={linkedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="dw-badge dw-badge--linked-dataset"
            title={primaryLinked?.title || 'Abrir dataset vinculado'}
            onClick={(e) => e.stopPropagation()}
          >
            <DbIcon size={9} />
            {linkedLabel}
          </a>
        )}
        {r.year != null && (
          <span className="dw-card__year">{r.year}</span>
        )}
      </div>

      {accessUrl ? (
        <a
          href={accessUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="dw-card__title dw-card__title--link"
        >
          {titleText}
        </a>
      ) : (
        <h3 className="dw-card__title">{titleText}</h3>
      )}

      <p className="dw-card__meta">
        {visibleAuthors && <span>{visibleAuthors}{moreAuthors}</span>}
        {visibleAuthors && (r.journal || r.field) && ' · '}
        {isDataset && r.journal ? (
          <span className="dw-card__source dw-card__source--dataset">
            <DbIcon size={10} /> {r.journal}
          </span>
        ) : isChapter && r.journal ? (
          <span className="dw-card__source dw-card__source--book">
            en <em>{r.journal}</em>
          </span>
        ) : isBook && r.publisher ? (
          <span className="dw-card__source dw-card__source--book">
            {r.publisher}
          </span>
        ) : r.journal ? (
          <span className="dw-card__source">{r.journal}</span>
        ) : null}
        {r.field && (
          <>
            {(visibleAuthors || r.journal) && ' · '}
            <span className="dw-card__field">{r.field}</span>
          </>
        )}
      </p>

      {r.abstract && (
        <p className="dw-card__abstract">{r.abstract}</p>
      )}

      {isDataset && fair && <FairStrip scores={fair} />}

      <div className="dw-card__footer">
        <DwMetric label="FWCI" value={fwci} href={oaWorkUrl} />
        <DwMetric
          label={usesLabel}
          value={usesDisplay}
          href={linkCites ? oaWorkUrl : undefined}
          title={isDataset && usage ? 'Vistas + descargas (DataCite · Make Data Count)' : undefined}
        />
        <div className="dw-card__actions">
          <WorkCitationPanel work={w} compact ghost />
          {accessUrl && (
            <a
              href={accessUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`dw-act${isDataset ? ' dw-act--dataset' : ' dw-act--primary'}`}
            >
              {isDataset ? 'Descargar datos' : 'Acceder'}
            </a>
          )}
        </div>
      </div>
    </article>
  );
});

export default DiscoveryWorkCard;
