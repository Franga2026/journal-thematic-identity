import {
  memo,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { TYPE_ES, SDG_ES, SDG_NAME_TO_NUMBER } from '../../utils/constants';
import { stripTags } from '../../utils/helpers';
import { getWorkAccessUrl, getWorkNavigationUrl } from '../../utils/workAccess';
import { getData } from '../../utils/dataProcessing';
import { isSameResearcherProfileId } from '../../utils/researcherProfile';
import { getUtaLinks, matchAuthorToUtaLink } from '../../utils/utaAuthorLinks';
import { useOpenResearcherProfile } from '../../app/hooks/useOpenResearcherProfile';
import { getSourceInfo } from '../../services/sources/sourceAccess';
import {
  getWorkOpenAlexCitations,
  getWorkOpenAlexFwci,
} from '../../utils/workMetrics';
import { fwciIsEligible } from '../../shared/metrics/fwci';
import WorkCitationPanel from './WorkCitationPanel';
import AISummaryButton from '../ai/AISummaryButton';
import { summarizeWork } from '../../api/aiApi';
import type { WorkSummaryStructured } from '../../services/ai/types';
import type { DatasetRecord, Researcher, Work } from '../../shared/types';
import {
  datasetAccessUrl,
  datasetCitations,
  datasetRepoLabel,
} from '../../utils/datasetWorkCard';
import { fetchDataCiteUsage, type DataCiteUsage } from '../../utils/datasetUsage';

export const ODS_COLORS: Record<number, string> = {
  1: '#E5243B',
  2: '#DDA63A',
  3: '#4C9F38',
  4: '#C5192D',
  5: '#FF3A21',
  6: '#26BDE2',
  7: '#FCC30B',
  8: '#A21942',
  9: '#FD6925',
  10: '#DD1367',
  11: '#FD9D24',
  12: '#BF8B2E',
  13: '#3F7E44',
  14: '#0A97D9',
  15: '#56C02B',
  16: '#00689D',
  17: '#19486A',
};

function parseOpenAlexId(id?: string): string {
  if (!id) return '';
  return id.replace(/^https?:\/\/openalex\.org\//i, '').trim();
}

function normDoi(d?: string): string {
  const raw = (d || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const bare = raw.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  return `https://doi.org/${bare}`;
}

function sdgNumber(sdg: string): number | null {
  const trimmed = sdg.trim();
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return n >= 1 && n <= 17 ? n : null;
  }
  const n = SDG_NAME_TO_NUMBER[sdg as keyof typeof SDG_NAME_TO_NUMBER];
  return n ?? null;
}

function sdgLabel(sdg: string): string {
  const num = sdgNumber(sdg);
  const name = SDG_ES[sdg as keyof typeof SDG_ES] || sdg;
  return num ? `ODS ${num}` : name;
}

function sdgChipStyle(sdg: string): CSSProperties {
  const num = sdgNumber(sdg);
  const bg = num ? ODS_COLORS[num] : 'var(--gray-100)';
  return { background: bg, color: 'var(--chip-ods-text)' };
}

function SdgChip({ sdg }: { sdg: string }) {
  const num = sdgNumber(sdg);
  const className = 'work-card__chip work-card__chip--ods';
  const style = sdgChipStyle(sdg);
  const label = sdgLabel(sdg);
  if (num) {
    return (
      <Link to={`/ods/${num}`} className={className} style={style}>
        {label}
      </Link>
    );
  }
  return (
    <span className={className} style={style}>
      {label}
    </span>
  );
}

export type UtaAuthorMatch = {
  researcher: Researcher;
  /** RUT de autores_uta (navegación /perfiles/<rut>) */
  profileId: string;
};

function getUtaLeadershipLabel(work: Work, catalog: Researcher[]): string | null {
  const authors = work.a || [];
  if (!getUtaLinks(work).length) return null;

  const utaIndices = authors
    .map((name, idx) => (matchAuthorToUtaLink(work, name, idx, catalog) != null ? idx : -1))
    .filter((idx) => idx >= 0);

  if (!utaIndices.length) return null;

  if (utaIndices.includes(0)) return 'Primer Autor';
  if (authors.length > 1 && utaIndices.includes(authors.length - 1)) return 'Autor de Correspondencia';
  return 'Coautor';
}

function IconExternalLink({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconDownload({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export type WorkCardVariant =
  | 'discovery'
  | 'production'
  | 'compact'
  | 'dataset'
  | 'openalex'
  | 'coauthor';

interface WorkCardProps {
  w?: Work;
  ds?: DatasetRecord;
  variant?: WorkCardVariant;
  /** profileId de autores_uta → abre ficha (resolveResearcherProfile + URL) */
  onOpenResearcher?: (profileId: string) => void;
  /** Investigador cuya ficha está abierta; oculta "Ver ficha" en autoenlace */
  currentResearcher?: Researcher | null;
}

function MetricTile({
  label,
  value,
  valueClass,
  note,
  sigla,
  openAlexWorkUrl,
  icon,
  title,
}: {
  label: string;
  value: string;
  valueClass?: string;
  note?: string;
  sigla?: boolean;
  openAlexWorkUrl?: string | null;
  icon?: ReactNode;
  title?: string;
}) {
  return (
    <div className="work-card__metric" title={title}>
      {openAlexWorkUrl && (
        <a
          href={openAlexWorkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="work-card__metric-ext-link"
          aria-label={`Ver en OpenAlex (${label})`}
        >
          <IconExternalLink className="work-card__metric-ext" aria-hidden />
        </a>
      )}
      <span className={`work-card__metric-label${sigla ? ' work-card__metric-label--sigla' : ''}`}>
        {icon && <span className="work-card__metric-label-icon">{icon}</span>}
        {label}
      </span>
      <div className={`work-card__metric-value ${valueClass || ''}`}>{value}</div>
      {note && <div className="work-card__metric-note">{note}</div>}
    </div>
  );
}

const OpenAlexWorkCard = memo(function OpenAlexWorkCard({ w }: { w: Work }) {
  const title = stripTags(w.t) || 'Sin título';
  const year = w.y != null ? String(w.y) : '';
  const source = w.s?.trim() || '';
  const authors = w.a || [];
  const maxAuthors = 3;
  const visibleAuthors = authors.slice(0, maxAuthors);
  const moreAuthors = authors.length > maxAuthors ? authors.length - maxAuthors : 0;

  const navUrl = getWorkNavigationUrl(w);
  const openAlexId = parseOpenAlexId(w.openalex_id);
  const openAlexWorkUrl = openAlexId ? `https://openalex.org/works/${openAlexId}` : null;

  const cites = getWorkOpenAlexCitations(w);
  const fwciEligible = fwciIsEligible(w);
  const fwci = getWorkOpenAlexFwci(w);
  const fwciDisplay = fwciEligible && fwci !== null ? fwci.toFixed(2) : '—';
  const fwciNote =
    fwciEligible && fwci !== null ? `${fwci.toFixed(2)}× la media del campo` : undefined;
  const fwciClass =
    !fwciEligible || fwci === null ? 'work-card__metric-value--muted'
    : fwci >= 1 ? 'work-card__metric-value--positive'
    : 'work-card__metric-value--neutral';

  const metaParts = [year, source].filter(Boolean);

  const handleTitleClick = (e: MouseEvent) => {
    e.preventDefault();
    if (!navUrl) return;
    window.open(navUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <article className="work-card work-card--openalex">
      {navUrl ? (
        <a
          href={navUrl}
          className="work-card__title work-card__title--link"
          onClick={handleTitleClick}
          target="_blank"
          rel="noopener noreferrer"
        >
          {title}
        </a>
      ) : (
        <h3 className="work-card__title">{title}</h3>
      )}

      {authors.length > 0 && (
        <div className="work-card__authors">
          {visibleAuthors.map((authorName, idx) => (
            <span key={`${authorName}-${idx}`} className="work-card__author-row">
              {idx > 0 && <span className="work-card__author-sep">, </span>}
              <span className="work-card__author">{authorName}</span>
            </span>
          ))}
          {moreAuthors > 0 && (
            <span className="work-card__author-more"> +{moreAuthors}</span>
          )}
        </div>
      )}

      <div className="work-card__meta">
        {metaParts.length > 0 && (
          <p className="work-card__meta-text">{metaParts.join(' · ')}</p>
        )}
        <div className="work-card__meta-actions">
          <WorkCitationPanel work={w} compact ghost />
        </div>
      </div>

      <div className="work-card__metrics work-card__metrics--openalex">
        <MetricTile
          label="FWCI"
          sigla
          value={fwciDisplay}
          valueClass={fwciClass}
          note={fwciNote}
          openAlexWorkUrl={openAlexWorkUrl}
        />
        <MetricTile
          label="Citas"
          value={cites.toLocaleString()}
          note="citas en OpenAlex"
          openAlexWorkUrl={openAlexWorkUrl}
        />
      </div>

      {w.oa === true && (
        <div className="work-card__chips">
          <div className="work-card__chips-left">
            <span className="work-card__chip work-card__chip--oa">Acceso abierto</span>
          </div>
        </div>
      )}
    </article>
  );
});

const CoAuthorWorkCard = memo(function CoAuthorWorkCard({
  w,
  onOpenResearcher,
}: {
  w: Work;
  onOpenResearcher?: (profileId: string) => void;
}) {
  const { openLocalResearcherProfile } = useOpenResearcherProfile();
  const catalog = useMemo(() => getData(), []);

  const title = stripTags(w.t) || 'Sin título';
  const year = w.y != null ? String(w.y) : '';
  const source = w.s?.trim() || '';
  const authors = w.a || [];
  const maxAuthors = 3;
  const visibleAuthors = authors.slice(0, maxAuthors);
  const moreAuthors = authors.length > maxAuthors ? authors.length - maxAuthors : 0;

  const doiUrl = w.d ? normDoi(w.d) : null;
  const openAlexId = parseOpenAlexId(w.openalex_id);
  const openAlexWorkUrl = openAlexId ? `https://openalex.org/works/${openAlexId}` : null;

  const cites = getWorkOpenAlexCitations(w);
  const fwciEligible = fwciIsEligible(w);
  const fwci = getWorkOpenAlexFwci(w);
  const hasUtaLinks = getUtaLinks(w).length > 0;
  const isEnriched =
    hasUtaLinks
    || Boolean(w.qi)
    || w.impact != null
    || w.fwci != null
    || (w.sdgs || []).length > 0;
  const showCitasTile = cites > 0;
  const showFwciTile =
    w.impact != null || w.fwci != null || fwci !== null || fwciEligible;
  const showMetrics = showCitasTile || showFwciTile;

  const metaParts = [year, source].filter(Boolean);

  const fwciDisplay = fwciEligible && fwci !== null ? fwci.toFixed(2) : '—';
  const fwciNote =
    fwciEligible && fwci !== null ? `${fwci.toFixed(2)}× la media del campo` : undefined;
  const fwciClass =
    !fwciEligible || fwci === null ? 'work-card__metric-value--muted'
    : fwci >= 1 ? 'work-card__metric-value--positive'
    : 'work-card__metric-value--neutral-fwci';

  const handleTitleClick = (e: MouseEvent) => {
    e.preventDefault();
    if (!doiUrl) return;
    window.open(doiUrl, '_blank', 'noopener,noreferrer');
  };

  const handleAccessClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!doiUrl) return;
    window.open(doiUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenResearcher = (e: MouseEvent, match: UtaAuthorMatch) => {
    e.stopPropagation();
    const rut = match.profileId;
    if (onOpenResearcher) {
      onOpenResearcher(rut);
      return;
    }
    openLocalResearcherProfile(match.researcher);
  };

  const hasChips =
    (isEnriched && Boolean(w.qi))
    || w.oa === true
    || (isEnriched && (w.sdgs || []).length > 0);

  return (
    <article className={`work-card work-card--coauthor${isEnriched ? '' : ' work-card--coauthor-lite'}`}>
      {doiUrl ? (
        <a
          href={doiUrl}
          className="work-card__title work-card__title--link"
          onClick={handleTitleClick}
          target="_blank"
          rel="noopener noreferrer"
        >
          {title}
        </a>
      ) : (
        <h3 className="work-card__title">{title}</h3>
      )}

      {authors.length > 0 && (
        <div className="work-card__authors work-card__authors--coauthor">
          {visibleAuthors.map((authorName, idx) => {
            const linkMatch = matchAuthorToUtaLink(w, authorName, idx, catalog);
            const utaMatch = linkMatch
              ? { researcher: linkMatch.researcher, profileId: linkMatch.link.rut }
              : null;
            return (
              <span key={`${authorName}-${idx}`} className="work-card__author-row">
                {idx > 0 && <span className="work-card__author-sep">, </span>}
                {utaMatch && isEnriched ? (
                  <span className="work-card__author work-card__author--uta">
                    <span className="work-card__author-name">{authorName}</span>
                    <button
                      type="button"
                      className="work-card__profile-link"
                      title={`Ver ficha de ${authorName}`}
                      onClick={(e) => handleOpenResearcher(e, utaMatch)}
                    >
                      <IconUser className="work-card__profile-icon" />
                      Ver ficha
                    </button>
                  </span>
                ) : (
                  <span className="work-card__author">{authorName}</span>
                )}
              </span>
            );
          })}
          {moreAuthors > 0 && (
            <span className="work-card__author-more"> +{moreAuthors} más</span>
          )}
        </div>
      )}

      {metaParts.length > 0 && (
        <p className="work-card__meta-text work-card__meta-text--coauthor">{metaParts.join(' · ')}</p>
      )}

      {showMetrics && (
        <div className="work-card__metrics work-card__metrics--coauthor">
          {showFwciTile && (
            <MetricTile
              label="FWCI"
              sigla
              value={fwciDisplay}
              valueClass={fwciClass}
              note={fwciNote}
              openAlexWorkUrl={openAlexWorkUrl}
            />
          )}
          {showCitasTile && (
            <MetricTile
              label="Citas"
              value={cites.toLocaleString()}
              note="citas en OpenAlex"
              openAlexWorkUrl={openAlexWorkUrl}
            />
          )}
        </div>
      )}

      <div className="work-card__chips work-card__chips--coauthor">
        {hasChips && (
          <div className="work-card__chips-left">
            {isEnriched && w.qi && (
              <span className="work-card__chip work-card__chip--quartile">
                SJR · {w.qi}
              </span>
            )}
            {w.oa === true && (
              <span className="work-card__chip work-card__chip--oa">
                <span className="work-card__chip-lock" aria-hidden>🔓</span>
                Acceso abierto
              </span>
            )}
            {isEnriched && (w.sdgs || []).map((sdg) => (
              <SdgChip key={sdg} sdg={sdg} />
            ))}
          </div>
        )}
        <div className="work-card__chips-actions work-card__chips-actions--coauthor">
          <WorkCitationPanel work={w} compact ghost />
          {doiUrl && (
            <button
              type="button"
              onClick={handleAccessClick}
              className="btn work-card__access-btn"
            >
              Acceder
            </button>
          )}
        </div>
      </div>
    </article>
  );
});

const DatasetWorkCard = memo(function DatasetWorkCard({
  ds,
  onOpenResearcher,
  currentResearcher,
}: {
  ds: DatasetRecord;
  onOpenResearcher?: (profileId: string) => void;
  currentResearcher?: Researcher | null;
}) {
  const { openLocalResearcherProfile } = useOpenResearcherProfile();
  const catalog = useMemo(() => getData(), []);

  const title = ds.title?.trim() || 'Sin título';
  const year = ds.year != null ? String(ds.year) : '';
  const accessUrl = datasetAccessUrl(ds);
  const repo = datasetRepoLabel(ds);
  const cites = datasetCitations(ds);
  const authors = ds.authors || [];
  const openAlexId = parseOpenAlexId(ds.openalex_id);
  const openAlexWorkUrl = openAlexId ? `https://openalex.org/works/${openAlexId}` : null;
  const doiUrl = ds.doi ? normDoi(ds.doi) : null;
  const [usage, setUsage] = useState<DataCiteUsage | null>(null);

  useEffect(() => {
    if (!ds.doi) {
      setUsage(null);
      return;
    }
    let cancelled = false;
    fetchDataCiteUsage(ds.doi).then((result) => {
      if (!cancelled) setUsage(result);
    });
    return () => {
      cancelled = true;
    };
  }, [ds.doi]);

  const syntheticWork = useMemo(
    (): Work => ({
      t: title,
      y: ds.year,
      a: authors,
      openalex_id: ds.openalex_id,
    }),
    [title, ds.year, authors, ds.openalex_id],
  );

  const handleTitleClick = (e: MouseEvent) => {
    e.preventDefault();
    if (!accessUrl) return;
    window.open(accessUrl, '_blank', 'noopener,noreferrer');
  };

  const handleAccessClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!accessUrl) return;
    window.open(accessUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenResearcher = (e: MouseEvent, match: UtaAuthorMatch) => {
    e.stopPropagation();
    const rut = match.profileId;
    if (onOpenResearcher) {
      onOpenResearcher(rut);
      return;
    }
    openLocalResearcherProfile(match.researcher);
  };

  const metaParts = ['Dataset', year].filter(Boolean);

  return (
    <article className="work-card work-card--dataset">
      {accessUrl ? (
        <a
          href={accessUrl}
          className="work-card__title work-card__title--link"
          onClick={handleTitleClick}
          target="_blank"
          rel="noopener noreferrer"
        >
          {title}
        </a>
      ) : (
        <h3 className="work-card__title">{title}</h3>
      )}

      <div className="work-card__meta">
        {metaParts.length > 0 && (
          <p className="work-card__meta-text">
            <span className="work-card__dataset-badge" aria-hidden>
              🗄️{' '}
            </span>
            {metaParts.join(' · ')}
          </p>
        )}
        {doiUrl && (
          <div className="work-card__meta-actions">
            <a
              href={doiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="work-card__doi-link"
            >
              DOI ↗
            </a>
          </div>
        )}
      </div>

      {authors.length > 0 && (
        <div className="work-card__authors">
          {authors.slice(0, 8).map((authorName, idx) => {
            const linkMatch = matchAuthorToUtaLink(syntheticWork, authorName, idx, catalog);
            const utaMatch = linkMatch
              ? { researcher: linkMatch.researcher, profileId: linkMatch.link.rut }
              : null;
            const isSelf = utaMatch
              ? isSameResearcherProfileId(utaMatch.profileId, currentResearcher, catalog)
              : false;
            return (
              <span key={`${authorName}-${idx}`} className="work-card__author-row">
                {idx > 0 && <span className="work-card__author-sep">, </span>}
                {utaMatch ? (
                  <span
                    className={`work-card__author work-card__author--uta${
                      isSelf ? ' work-card__author--focus' : ''
                    }`}
                  >
                    <span className="work-card__author-name">{authorName}</span>
                    {!isSelf && (
                      <button
                        type="button"
                        className="work-card__profile-link"
                        title={`Ver ficha de ${authorName}`}
                        onClick={(e) => handleOpenResearcher(e, utaMatch)}
                      >
                        <IconUser className="work-card__profile-icon" />
                        Ver ficha
                      </button>
                    )}
                  </span>
                ) : (
                  <span className="work-card__author">{authorName}</span>
                )}
              </span>
            );
          })}
          {authors.length > 8 && (
            <span className="work-card__author-more"> +{authors.length - 8}</span>
          )}
        </div>
      )}

      <div className="work-card__metrics work-card__metrics--dataset">
        {usage && usage.viewCount > 0 && (
          <MetricTile
            label="Vistas"
            value={usage.viewCount.toLocaleString()}
            icon={<IconEye className="work-card__metric-icon" />}
            title="Make Data Count (COUNTER) · DataCite"
          />
        )}
        {usage && usage.downloadCount > 0 && (
          <MetricTile
            label="Descargas"
            value={usage.downloadCount.toLocaleString()}
            icon={<IconDownload className="work-card__metric-icon" />}
            title="Make Data Count (COUNTER) · DataCite"
          />
        )}
        <MetricTile
          label="Citas"
          value={cites.toLocaleString()}
          note="citas en OpenAlex"
          openAlexWorkUrl={openAlexWorkUrl}
        />
      </div>

      <div className="work-card__chips">
        <div className="work-card__chips-left">
          <span className="work-card__chip work-card__chip--dataset">🗄️ Dataset</span>
          {repo && (
            <span className="work-card__chip work-card__chip--repo">{repo}</span>
          )}
          {ds.is_oa === true && (
            <span className="work-card__chip work-card__chip--oa">Acceso abierto</span>
          )}
        </div>
        <div className="work-card__chips-actions">
          <button
            type="button"
            disabled={!accessUrl}
            title={accessUrl ? undefined : 'Sin enlace de acceso disponible'}
            onClick={handleAccessClick}
            className="btn work-card__access-btn"
          >
            Acceder
          </button>
        </div>
      </div>
    </article>
  );
});

const WorkCard = memo(function WorkCard({
  w,
  ds,
  variant = 'discovery',
  onOpenResearcher,
  currentResearcher,
}: WorkCardProps) {
  const { openLocalResearcherProfile } = useOpenResearcherProfile();
  const catalog = useMemo(() => getData(), []);

  if (variant === 'dataset') {
    if (!ds) return null;
    return (
      <DatasetWorkCard
        ds={ds}
        onOpenResearcher={onOpenResearcher}
        currentResearcher={currentResearcher}
      />
    );
  }

  if (variant === 'openalex') {
    if (!w) return null;
    return <OpenAlexWorkCard w={w} />;
  }

  if (variant === 'coauthor') {
    if (!w) return null;
    return <CoAuthorWorkCard w={w} onOpenResearcher={onOpenResearcher} />;
  }

  if (!w) return null;

  const isCompact = variant === 'compact';
  const title = stripTags(w.t) || 'Sin título';
  const year = w.y != null ? String(w.y) : '';
  const source = w.s?.trim() || '';
  const type = TYPE_ES[w.tp as keyof typeof TYPE_ES] || w.tp || '';
  const publisher = w.pub || w.cr_pub || '';
  const cites = getWorkOpenAlexCitations(w);
  const authors = w.a || [];
  const fwciEligible = fwciIsEligible(w);
  const fwci = getWorkOpenAlexFwci(w);
  const maxAuthors = isCompact ? 3 : 8;
  const visibleAuthors = authors.slice(0, maxAuthors);
  const moreAuthors = authors.length > maxAuthors ? authors.length - maxAuthors : 0;

  const srcInfo = getSourceInfo(w.s);
  const accessUrl = getWorkAccessUrl(w);
  const navUrl = getWorkNavigationUrl(w);
  const openAlexId = parseOpenAlexId(w.openalex_id);
  const doiUrl = w.d ? normDoi(w.d) : null;
  const openAlexWorkUrl = openAlexId ? `https://openalex.org/works/${openAlexId}` : null;

  const isOpenAccess = srcInfo.access === 'oa' || Boolean(w.oa);
  const leadership = variant === 'discovery' ? getUtaLeadershipLabel(w, catalog) : null;

  const metaParts = [type, year, source, publisher || srcInfo.publisher].filter(Boolean);

  const handleTitleClick = (e: MouseEvent) => {
    e.preventDefault();
    if (!navUrl) return;
    window.open(navUrl, '_blank', 'noopener,noreferrer');
  };

  const handleAccessClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!accessUrl) return;
    window.open(accessUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenResearcher = (e: MouseEvent, match: UtaAuthorMatch) => {
    e.stopPropagation();
    const rut = match.profileId;
    if (onOpenResearcher) {
      onOpenResearcher(rut);
      return;
    }
    openLocalResearcherProfile(match.researcher);
  };

  const fwciDisplay = fwciEligible && fwci !== null ? fwci.toFixed(2) : '—';
  const fwciNote =
    fwciEligible && fwci !== null ? `${fwci.toFixed(2)}× la media del campo` : undefined;
  const fwciClass =
    !fwciEligible || fwci === null ? 'work-card__metric-value--muted'
    : fwci >= 1 ? 'work-card__metric-value--positive'
    : 'work-card__metric-value--neutral';

  return (
    <article className={`work-card work-card--${variant}`}>
      {navUrl ? (
        <a
          href={navUrl}
          className="work-card__title work-card__title--link"
          onClick={handleTitleClick}
          target="_blank"
          rel="noopener noreferrer"
        >
          {title}
        </a>
      ) : (
        <h3 className="work-card__title">{title}</h3>
      )}

      <div className="work-card__meta">
        {metaParts.length > 0 && (
          <p className="work-card__meta-text">{metaParts.join(' · ')}</p>
        )}
        <div className="work-card__meta-actions">
          {doiUrl && (
            <a
              href={doiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="work-card__doi-link"
            >
              DOI ↗
            </a>
          )}
          <WorkCitationPanel work={w} compact={isCompact} ghost />
        </div>
      </div>

      {authors.length > 0 && (
        <div className="work-card__authors">
          {visibleAuthors.map((authorName, idx) => {
            const linkMatch = matchAuthorToUtaLink(w, authorName, idx, catalog);
            const utaMatch = linkMatch
              ? { researcher: linkMatch.researcher, profileId: linkMatch.link.rut }
              : null;
            const isSelf = utaMatch
              ? isSameResearcherProfileId(utaMatch.profileId, currentResearcher, catalog)
              : false;
            return (
              <span key={`${authorName}-${idx}`} className="work-card__author-row">
                {idx > 0 && <span className="work-card__author-sep">, </span>}
                {utaMatch ? (
                  <span
                    className={`work-card__author work-card__author--uta${
                      isSelf ? ' work-card__author--focus' : ''
                    }`}
                  >
                    <span className="work-card__author-name">{authorName}</span>
                    {!isSelf && (
                      <button
                        type="button"
                        className="work-card__profile-link"
                        title={`Ver ficha de ${authorName}`}
                        onClick={(e) => handleOpenResearcher(e, utaMatch)}
                      >
                        <IconUser className="work-card__profile-icon" />
                        Ver ficha
                      </button>
                    )}
                  </span>
                ) : (
                  <span className="work-card__author">{authorName}</span>
                )}
              </span>
            );
          })}
          {moreAuthors > 0 && (
            <span className="work-card__author-more"> +{moreAuthors}</span>
          )}
        </div>
      )}

      {(w.field || w.topic) && (
        <p className="work-card__topics">
          {w.topic || w.field}
          {w.subfield && w.subfield !== w.field ? ` · ${w.subfield}` : ''}
        </p>
      )}

      <div className="work-card__metrics">
        <MetricTile
          label="FWCI"
          sigla
          value={fwciDisplay}
          valueClass={fwciClass}
          note={fwciNote}
          openAlexWorkUrl={openAlexWorkUrl}
        />
        <MetricTile
          label="Citas"
          value={cites.toLocaleString()}
          note="citas en OpenAlex"
          openAlexWorkUrl={openAlexWorkUrl}
        />
      </div>

      <div className="work-card__chips">
        <div className="work-card__chips-left">
          {w.qi && (
            <span className="work-card__chip work-card__chip--quartile">
              SJR · {w.qi}
            </span>
          )}
          {w.field && (
            <span className="work-card__chip work-card__chip--field">{w.field}</span>
          )}
          {(w.sdgs || []).map((sdg) => (
            <SdgChip key={sdg} sdg={sdg} />
          ))}
          {isOpenAccess && (
            <span className="work-card__chip work-card__chip--oa">Acceso abierto</span>
          )}
          {variant === 'discovery' && leadership && (
            <span className="work-card__chip work-card__chip--leadership">{leadership}</span>
          )}
        </div>
        <div className="work-card__chips-actions">
          <AISummaryButton
            label="Resumen IA"
            panelTitle="Resumen IA de la publicación"
            compact={isCompact}
            ghost
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
            disabled={!accessUrl}
            title={accessUrl ? undefined : 'Sin enlace de acceso disponible'}
            onClick={handleAccessClick}
            className="btn work-card__access-btn"
          >
            Acceder
          </button>
        </div>
      </div>
    </article>
  );
});

export default WorkCard;
