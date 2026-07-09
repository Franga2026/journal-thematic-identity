import { useMemo, useState } from 'react';
import FwciInfoTooltip from './FwciInfoTooltip';
import './fwci-info-tooltip.css';
import type { Researcher } from '../../shared/types';
import type { OpenAlexAuthorKpis } from '../../services/discovery/computeOpenAlexAuthorKpis';
import type {
  AuthorEcosystem,
  EcosystemCoauthor,
  FeaturedWork,
  WorkForEcosystem,
  WorkSortMode,
} from '../../services/discovery/computeAuthorEcosystem';
import { sortWorksForDisplay } from '../../services/discovery/computeAuthorEcosystem';
import { findResearcherByOpenAlexAuthorId } from '../../utils/researcherProfile';
import { getWorkResourceLinks } from '../../utils/workAccess';

const Q_COLORS: Record<string, string> = {
  Q1: '#15803D',
  Q2: '#0E7E9E',
  Q3: '#D97706',
  Q4: '#B5482F',
};

const KPI_TILES = [
  { key: 'h_index', label: 'h-index', bg: '#E6F1FB', color: '#185FA5' },
  { key: 'output', label: 'Producción', bg: '#EEEDFE', color: '#534AB7' },
  { key: 'cites', label: 'Citas', bg: '#FAEEDA', color: '#854F0B' },
  { key: 'cpp', label: 'Citas/Pub', bg: '#E1F5EE', color: '#0F6E56' },
  { key: 'oa_rate', label: 'Acceso ab.', bg: '#EAF3DE', color: '#3B6D11' },
  { key: 'datasets', label: 'Datasets', bg: '#FBEAF0', color: '#993556' },
] as const;

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

function coauthorInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) || '??').toUpperCase();
}

function fmtKpi(v: number | null, kind: 'num' | 'pct' | 'dec' = 'num'): string {
  if (v == null || Number.isNaN(v)) return '—';
  if (kind === 'pct') return `${Math.round(v * 100)}%`;
  if (kind === 'dec') return v.toFixed(1).replace('.', ',');
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.0', '')}K`;
  return String(v);
}

function kpiValue(kpis: OpenAlexAuthorKpis, key: string): string {
  switch (key) {
    case 'h_index':
      return fmtKpi(kpis.hIndex);
    case 'output':
      return fmtKpi(kpis.worksCount);
    case 'cites':
      return fmtKpi(kpis.citedByCount);
    case 'cpp':
      return fmtKpi(kpis.cpp, 'dec');
    case 'oa_rate':
      return fmtKpi(kpis.oaRate, 'pct');
    case 'datasets':
      return fmtKpi(kpis.datasetsCount);
    default:
      return '—';
  }
}

function FwciGauge({ fwci, fwciN }: { fwci: number | null; fwciN: number }) {
  const r = 48;
  const halfLen = Math.PI * r;
  const ratio = fwci != null ? Math.min(fwci / 10, 1) : 0;
  const dash = ratio * halfLen;
  const display = fwci != null ? fwci.toFixed(1).replace('.', ',') : '—';

  return (
    <div>
      <svg viewBox="0 0 120 90" width="130" role="img" aria-label={`FWCI ${display}`}>
        <path
          d="M 12 78 A 48 48 0 0 1 108 78"
          fill="none"
          stroke="#E1F5EE"
          strokeWidth="11"
          strokeLinecap="round"
        />
        {fwci != null && (
          <path
            d="M 12 78 A 48 48 0 0 1 108 78"
            fill="none"
            stroke="#0F6E56"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${halfLen}`}
          />
        )}
        <text x="60" y="62" textAnchor="middle" fontSize="26" fontWeight="500" fill="#0F6E56">
          {display}
        </text>
        <text x="60" y="76" textAnchor="middle" fontSize="8" fill="#5DCAA5">
          × media
        </text>
      </svg>
      <div className="vb-gcap">FWCI <FwciInfoTooltip /></div>
      <div className="vb-gsub">
        {fwciN > 0 ? `sobre ${fwciN.toLocaleString('es-CL')} obras` : 'sin datos FWCI'}
      </div>
    </div>
  );
}

function typeLabel(type: string | null): string {
  if (type === 'dataset') return 'DATASET';
  if (type === 'book' || type === 'book-chapter') return 'LIBRO';
  if (type === 'preprint') return 'PREPRINT';
  return 'ARTÍCULO';
}

export interface OpenAlexResearcherModalProps {
  name: string;
  affiliation: string | null;
  country: string | null;
  countryLabel?: string | null;
  orcid?: string | null;
  openAlexId?: string | null;
  kpis: OpenAlexAuthorKpis | null;
  ecosystem: AuthorEcosystem | null;
  worksPool: WorkForEcosystem[];
  worksTotal: number;
  loading?: boolean;
  worksLoading?: boolean;
  canLoadMore?: boolean;
  onClose: () => void;
  onOpenUtaProfile: (researcher: Researcher) => void;
  onOpenCoauthor: (coauthor: EcosystemCoauthor) => void;
  onLoadMoreWorks?: () => void;
}

export default function OpenAlexResearcherModal({
  name,
  affiliation,
  country,
  countryLabel,
  orcid,
  openAlexId,
  kpis,
  ecosystem,
  worksPool,
  worksTotal,
  loading = false,
  worksLoading = false,
  canLoadMore = false,
  onClose,
  onOpenUtaProfile,
  onOpenCoauthor,
  onLoadMoreWorks,
}: OpenAlexResearcherModalProps) {
  const [sortMode, setSortMode] = useState<WorkSortMode>('fwci');

  const displayedWorks = useMemo(
    () => sortWorksForDisplay(worksPool, sortMode),
    [worksPool, sortMode],
  );

  const openAlexLink = openAlexId
    ? `https://openalex.org/authors/${openAlexId.replace(/^https?:\/\/openalex\.org\//i, '')}`
    : null;
  const hasAside = Boolean(
    ecosystem && (
      ecosystem.topJournals.length > 0
      || ecosystem.topFields.length > 0
      || ecosystem.quartiles.withQuartile > 0
      || ecosystem.topCoauthors.length > 0
    ),
  );

  const handleCoauthorClick = (c: EcosystemCoauthor) => {
    if (c.isUta && c.author_id) {
      const local = findResearcherByOpenAlexAuthorId(c.author_id);
      if (local) {
        onOpenUtaProfile(local);
        return;
      }
    }
    onOpenCoauthor(c);
  };

  return (
    <div className="modal-overlay oarm-overlay" onClick={onClose}>
      <div
        className="vb-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="vb-modal-title"
      >
        <button type="button" className="vb-close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>

        <div className="vb-hero">
          <div className="vb-av" aria-hidden>{initials(name)}</div>
          <div className="vb-hero__body">
            <h2 id="vb-modal-title" className="vb-name">{name || 'Cargando…'}</h2>
            {(affiliation || countryLabel || country) && (
              <div className="vb-affiliation">
                {affiliation && (
                  <div className="vb-affiliation__row">
                    <span className="vb-affiliation__icon" aria-hidden>🏛</span>
                    <span className="vb-affiliation__text">{affiliation}</span>
                  </div>
                )}
                {(countryLabel || country) && (
                  <div className="vb-affiliation__row">
                    <span className="vb-affiliation__icon" aria-hidden>🌍</span>
                    <span className="vb-affiliation__text">
                      {countryLabel || country}
                      {country && countryLabel && countryLabel !== country && (
                        <span className="vb-affiliation__code"> ({country})</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="vb-chips">
              {orcid && (
                <a
                  href={`https://orcid.org/${orcid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vb-chip"
                >
                  ORCID
                </a>
              )}
              {openAlexLink && (
                <a href={openAlexLink} target="_blank" rel="noopener noreferrer" className="vb-chip">
                  OpenAlex
                </a>
              )}
            </div>
          </div>
        </div>

        {loading && !kpis ? (
          <div className="vb-loading">Calculando ficha bibliométrica desde OpenAlex…</div>
        ) : (
          <>
            <div className="vb-body">
              {kpis && (
                <div className="vb-row">
                  <FwciGauge fwci={kpis.fwciMean} fwciN={kpis.fwciN} />
                  <div className="vb-kpis">
                    {KPI_TILES.map((t) => (
                      <div key={t.key} className="vb-kpi" style={{ background: t.bg }}>
                        <div className="vb-kpi-v" style={{ color: t.color }}>
                          {kpiValue(kpis, t.key)}
                        </div>
                        <div className="vb-kpi-l" style={{ color: t.color }}>
                          {t.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {kpis && kpis.distinctions.length > 0 && (
                <div className="vb-tags">
                  {kpis.distinctions.map((d) => (
                    <span key={d} className="vb-tag">{d}</span>
                  ))}
                </div>
              )}
            </div>

            <div className={`vb-layout${hasAside ? '' : ' vb-layout--solo'}`}>
              {(displayedWorks.length > 0 || worksLoading) && (
                <section className="vb-block vb-block--main">
                  <div className="vb-section-head">
                    <h4 className="vb-t vb-t--plain">
                      <span className="vb-t-icon" aria-hidden>📄</span>
                      Producción científica
                      {worksTotal > 0 && (
                        <span className="vb-t-count">
                          {displayedWorks.length.toLocaleString('es-CL')}
                          {worksTotal > displayedWorks.length
                            ? ` / ${worksTotal.toLocaleString('es-CL')}`
                            : ''}
                        </span>
                      )}
                    </h4>
                    <label className="vb-sort">
                      <span className="vb-sort-lbl">Ordenar por</span>
                      <select
                        className="vb-select"
                        value={sortMode}
                        onChange={(e) => setSortMode(e.target.value as WorkSortMode)}
                        aria-label="Ordenar publicaciones"
                      >
                        <option value="fwci">Mayor FWCI</option>
                        <option value="citas">Más citadas</option>
                        <option value="anio">Más recientes</option>
                      </select>
                    </label>
                  </div>
                  {displayedWorks.length > 0 && (
                    <div className="vb-wgrid">
                      {displayedWorks.map((w) => (
                        <WorkCardMini key={w.openalex_id || `${w.title}-${w.year}`} work={w} />
                      ))}
                    </div>
                  )}
                  {worksLoading && (
                    <div className="vb-loading vb-loading--inline">Cargando publicaciones…</div>
                  )}
                  {canLoadMore && onLoadMoreWorks && (
                    <div className="vb-more">
                      <button type="button" className="vb-link" onClick={onLoadMoreWorks}>
                        Cargar más ({(worksTotal - displayedWorks.length).toLocaleString('es-CL')} restantes) →
                      </button>
                    </div>
                  )}
                </section>
              )}

              {hasAside && ecosystem && (
                <aside className="vb-aside">
                  <section className="vb-block vb-block--aside">
                    <h4 className="vb-t">
                      <span className="vb-t-icon" aria-hidden>🏛</span>
                      Ecosistema
                    </h4>
                    {ecosystem.topJournals.length > 0 && (
                      <>
                        <div className="vb-eh">Revistas frecuentes</div>
                        {ecosystem.topJournals.slice(0, 5).map((j) => (
                          <div key={j.name} className="vb-jr">
                            <span className="vb-jn" title={j.name}>{j.name}</span>
                            <span className="vb-jc">{j.count}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {ecosystem.topFields.length > 0 && (
                      <>
                        <div className="vb-eh" style={{ marginTop: 14 }}>Áreas temáticas</div>
                        {ecosystem.topFields.slice(0, 5).map((f) => (
                          <div key={f.name} className="vb-jr">
                            <span className="vb-jn" title={f.name}>{f.name}</span>
                            <span className="vb-jc">{f.count}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {ecosystem.quartiles.withQuartile > 0 && (
                      <>
                        <div className="vb-eh" style={{ marginTop: 14 }}>Cuartil SJR</div>
                        {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => {
                          const n = ecosystem.quartiles[q];
                          const pct = ecosystem.quartiles.withQuartile
                            ? Math.round((n / ecosystem.quartiles.withQuartile) * 100)
                            : 0;
                          if (n === 0) return null;
                          return (
                            <div key={q} className="vb-qr">
                              <span className="vb-ql" style={{ color: Q_COLORS[q] }}>{q}</span>
                              <div className="vb-qt">
                                <div
                                  className="vb-qf"
                                  style={{ width: `${pct}%`, background: Q_COLORS[q] }}
                                />
                              </div>
                              <span className="vb-qv">
                                {n.toLocaleString('es-CL')} · {pct}%
                              </span>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </section>

                  {ecosystem.topCoauthors.length > 0 && (
                    <section className="vb-block vb-block--aside">
                      <h4 className="vb-t">
                        <span className="vb-t-icon" aria-hidden>👥</span>
                        Coautorías
                      </h4>
                      {ecosystem.topCoauthors.slice(0, 6).map((c) => {
                        const isUta = c.isUta;
                        const canOpen = isUta || Boolean(c.author_id);
                        const sub = c.institution
                          ? `${c.institution}${c.country ? ` · ${c.country}` : ''}`
                          : c.country || '';
                        const Tag = canOpen ? 'button' : 'div';
                        return (
                          <Tag
                            key={`${c.author_id || c.name}-${c.worksTogether}`}
                            type={canOpen ? 'button' : undefined}
                            className={`vb-ca${isUta ? ' vb-ca--uta' : ''}${canOpen && !isUta ? ' vb-ca--link' : ''}`}
                            onClick={canOpen ? () => handleCoauthorClick(c) : undefined}
                            title={canOpen ? `Ver ficha de ${c.name}` : undefined}
                          >
                            <span
                              className="vb-caav"
                              style={{
                                background: isUta ? '#eafaf3' : '#eef0f2',
                                color: isUta ? '#0F6E56' : '#556',
                              }}
                            >
                              {coauthorInitials(c.name)}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div className="vb-can">
                                {c.name}
                                {isUta && <span className="vb-utab">UTA</span>}
                              </div>
                              <div className="vb-cas">
                                {canOpen
                                  ? (isUta ? `${sub || 'Universidad de Tarapacá'} · ver ficha` : `${sub || 'Ver ficha bibliométrica'}`)
                                  : sub}
                              </div>
                            </div>
                            <span className="vb-cac">{c.worksTogether} obras</span>
                          </Tag>
                        );
                      })}
                      <div className="vb-caf">
                        {ecosystem.uniqueCountries > 0 && (
                          <span>🌍 {ecosystem.uniqueCountries} países</span>
                        )}
                        {ecosystem.uniqueInstitutions > 0 && (
                          <span>🏢 {ecosystem.uniqueInstitutions} instituciones</span>
                        )}
                        {ecosystem.utaCoauthorCount > 0 && (
                          <span className="vb-caf--uta">
                            ★ {ecosystem.utaCoauthorCount} coautor
                            {ecosystem.utaCoauthorCount === 1 ? '' : 'es'} UTA
                          </span>
                        )}
                      </div>
                    </section>
                  )}
                </aside>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function WorkCardMini({ work: w }: { work: FeaturedWork }) {
  const isDataset = w.type === 'dataset';
  const typeBg = isDataset ? '#EEEDFE' : '#e6f1fb';
  const typeColor = isDataset ? '#534AB7' : '#185FA5';
  const resourceLinks = getWorkResourceLinks({
    t: w.title,
    d: w.doi ?? undefined,
    openalex_id: w.openalex_id ?? undefined,
    pdf_url: w.pdf_url ?? undefined,
    ou: w.pdf_url ?? undefined,
    u: w.landing_url ?? undefined,
    open_access: w.oa_url ? { oa_url: w.oa_url, is_oa: w.is_oa } : undefined,
    primary_location: {
      pdf_url: w.pdf_url ?? undefined,
      landing_page_url: w.landing_url ?? undefined,
    },
  });

  return (
    <div className={`vb-wc${isDataset ? ' vb-wc--dataset' : ''}`}>
      <div className="vb-wc-badges">
        <span className="vb-badge" style={{ background: typeBg, color: typeColor }}>
          {typeLabel(w.type)}
        </span>
        {w.quartile && (
          <span className="vb-badge" style={{ background: Q_COLORS[w.quartile], color: '#fff' }}>
            {w.quartile}
          </span>
        )}
        {w.is_oa && (
          <span className="vb-badge" style={{ background: '#639922', color: '#fff' }}>OA</span>
        )}
      </div>
      <div className="vb-wc-title">{w.title}</div>
      <div className="vb-wc-meta">
        {w.year && <>{w.year} · </>}
        {w.journal && <em>{w.journal}</em>}
        {w.best_oa_repo && (
          <>
            {(w.year || w.journal) && ' · '}
            <span className="vb-wc-repo">{w.best_oa_repo}</span>
          </>
        )}
      </div>
      <div className="vb-wc-m">
        {w.fwci != null && (
          <span className="vb-wc-mi">
            FWCI <strong style={{ color: '#0F6E56' }}>{w.fwci.toFixed(1).replace('.', ',')}</strong>
          </span>
        )}
        <span className="vb-wc-mi">
          {isDataset ? 'USOS' : 'CITAS'}{' '}
          <strong style={{ color: '#14314e' }}>{w.cited_by_count.toLocaleString('es-CL')}</strong>
        </span>
      </div>
      {resourceLinks.length > 0 && (
        <div className="vb-wc-links">
          {resourceLinks.map((link) => (
            <a
              key={`${link.key}-${link.href}`}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`vb-wc-link vb-wc-link--${link.key}`}
              onClick={(e) => e.stopPropagation()}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
