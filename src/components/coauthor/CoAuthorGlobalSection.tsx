import { useMemo, useState } from 'react';
import type { GlobalProfile } from '../../shared/types/globalProfile';
import type { Work } from '../../shared/types';
import { stripTags } from '../../utils/helpers';
import { sortWorks, type SortKey } from '../../utils/sortWorks';
import ProductionWorkList from '../production/ProductionWorkList';
import ProductionViewToggle, { type ProductionViewMode } from '../production/ProductionViewToggle';
import TrendChart from '../researcher/TrendChart';

const Q_COLORS: Record<string, string> = {
  Q1: '#15803D',
  Q2: '#0E7E9E',
  Q3: '#D97706',
  Q4: '#B5482F',
};

export interface OdsReferentMetrics {
  fwci: number | null;
  publications: number;
  h_index: number | null;
  citations: number;
}

export interface CoAuthorGlobalSectionProps {
  profile: GlobalProfile;
  odsReferentLayout?: boolean;
  odsSdgNum?: number;
  odsMetrics?: OdsReferentMetrics;
  showTopWorks?: boolean;
}

function mapGlobalTopWork(w: GlobalProfile['top_works'][number]): Work {
  const oaOpen =
    w.oa_status != null
    && !['closed', 'closed_access'].includes(w.oa_status.toLowerCase());
  return {
    t: w.title,
    y: w.year,
    c: w.cited,
    fwci: w.fwci,
    impact: w.fwci ?? undefined,
    s: w.journal ?? undefined,
    d: w.doi,
    oa: oaOpen,
  };
}

function fmtNum(n: number | null | undefined, suffix = ''): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n.toLocaleString('es')}${suffix}`;
}

function OdsReferentGlobalSection({
  g,
  odsSdgNum,
  odsMetrics,
}: {
  g: GlobalProfile;
  odsSdgNum?: number;
  odsMetrics?: OdsReferentMetrics;
}) {
  const qp = g.cuartiles;
  const sdgLabel = odsSdgNum != null ? String(odsSdgNum) : '—';

  return (
    <section className="coauthor-section coauthor-global coauthor-global--ods">
      <div className="coauthor-zone-label">
        <span>🌐 Perfil global del investigador</span>
      </div>

      <div className="coauthor-ods-dual-kpi">
        <div className="coauthor-ods-kpi-card coauthor-ods-kpi-card--ods">
          <p className="coauthor-ods-kpi-card__title">Impacto en el ODS {sdgLabel}:</p>
          <div className="coauthor-ods-kpi-grid">
            <div className="coauthor-ods-kpi-cell">
              <span className="coauthor-ods-kpi-cell__value coauthor-ods-kpi-cell__value--green">
                {odsMetrics?.fwci != null ? `${odsMetrics.fwci.toLocaleString('es')}×` : '—'}
              </span>
              <span className="coauthor-ods-kpi-cell__label">FWCI</span>
            </div>
            <div className="coauthor-ods-kpi-cell">
              <span className="coauthor-ods-kpi-cell__value">
                {fmtNum(odsMetrics?.publications)}
              </span>
              <span className="coauthor-ods-kpi-cell__label">Publicaciones</span>
            </div>
            <div className="coauthor-ods-kpi-cell">
              <span className="coauthor-ods-kpi-cell__value">
                {fmtNum(odsMetrics?.h_index)}
              </span>
              <span className="coauthor-ods-kpi-cell__label">H-index</span>
            </div>
            <div className="coauthor-ods-kpi-cell">
              <span className="coauthor-ods-kpi-cell__value">
                {fmtNum(odsMetrics?.citations)}
              </span>
              <span className="coauthor-ods-kpi-cell__label">Citas</span>
            </div>
          </div>
        </div>

        <div className="coauthor-ods-kpi-card coauthor-ods-kpi-card--global">
          <p className="coauthor-ods-kpi-card__title">Trayectoria total:</p>
          <div className="coauthor-ods-kpi-grid">
            <div className="coauthor-ods-kpi-cell">
              <span className="coauthor-ods-kpi-cell__value">{fmtNum(g.h_index)}</span>
              <span className="coauthor-ods-kpi-cell__label">H-index</span>
            </div>
            <div className="coauthor-ods-kpi-cell">
              <span className="coauthor-ods-kpi-cell__value">{fmtNum(g.works_count)}</span>
              <span className="coauthor-ods-kpi-cell__label">Obras</span>
            </div>
            <div className="coauthor-ods-kpi-cell">
              <span className="coauthor-ods-kpi-cell__value">{fmtNum(g.cited_by_count)}</span>
              <span className="coauthor-ods-kpi-cell__label">Citas</span>
            </div>
            <div className="coauthor-ods-kpi-cell">
              <span className="coauthor-ods-kpi-cell__value coauthor-ods-kpi-cell__value--green">
                {g.fwci_mean != null ? `${g.fwci_mean.toLocaleString('es')}×` : '—'}
              </span>
              <span className="coauthor-ods-kpi-cell__label">FWCI</span>
            </div>
          </div>
        </div>
      </div>

      <div className="coauthor-ods-detail-row">
        <div className="coauthor-ods-detail-card">
          {qp && qp.with_quartile > 0 && (
            <>
              <p className="cg-sublabel">Cuartiles SJR</p>
              <div className="coauthor-ods-quartile-bar">
                {[
                  { q: 'Q1', c: Q_COLORS.Q1, n: qp.Q1 || 0 },
                  { q: 'Q2', c: Q_COLORS.Q2, n: qp.Q2 || 0 },
                  { q: 'Q3', c: Q_COLORS.Q3, n: qp.Q3 || 0 },
                  { q: 'Q4', c: Q_COLORS.Q4, n: qp.Q4 || 0 },
                ].map(({ q, c, n }) => {
                  const pct = qp.with_quartile ? (n / qp.with_quartile) * 100 : 0;
                  return pct > 0 ? (
                    <div
                      key={q}
                      className="coauthor-ods-quartile-seg"
                      style={{
                        width: `${pct}%`,
                        background: c,
                      }}
                    >
                      {pct > 8 ? n : ''}
                    </div>
                  ) : null;
                })}
              </div>
              <p className="coauthor-ods-quartile-legend">
                {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
                  const n = qp[q as keyof typeof qp] as number || 0;
                  const pct = qp.with_quartile ? Math.round((n / qp.with_quartile) * 100) : 0;
                  return `${q} ${pct}%`;
                }).join(' · ')}
              </p>
            </>
          )}
        </div>

        <div className="coauthor-ods-detail-card">
          <p className="cg-sublabel">Citación de élite · percentil mundial</p>
          <div className="coauthor-ods-elite">
            <div className="coauthor-ods-elite__item">
              <span className="coauthor-ods-elite__num">{g.elite.top10}</span>
              <span className="coauthor-ods-elite__lbl">top 10%</span>
            </div>
            <div className="coauthor-ods-elite__item">
              <span className="coauthor-ods-elite__num">{g.elite.top1}</span>
              <span className="coauthor-ods-elite__lbl">top 1%</span>
            </div>
          </div>
        </div>
      </div>

      {g.oa.segments.length > 0 && (
        <div className="coauthor-ods-oa">
          <div className="researcher-oa-head">
            <span className="researcher-impact__sublabel" style={{ margin: 0 }}>
              Acceso abierto
            </span>
            <span className="researcher-oa-head__pct">{g.oa.pct}%</span>
          </div>
          <div className="researcher-oa-bar">
            {g.oa.segments.map((s) => (
              <div
                key={s.key}
                style={{ flex: s.count, background: s.color }}
                title={`${s.label}: ${s.count} (${s.pct}%)`}
              />
            ))}
          </div>
          <div className="coauthor-ods-oa-legend">
            {g.oa.segments.map((s) => (
              <span key={s.key} className="coauthor-ods-oa-legend__item">
                <span className="coauthor-ods-oa-legend__dot" style={{ background: s.color }} />
                {s.label} {s.pct}%
              </span>
            ))}
          </div>
        </div>
      )}

      {g.scope.total > 0 && (
        <p className="coauthor-ods-scope-inline">
          {g.scope.intl}% intl · {g.scope.natl}% nac · {g.scope.inst}% inst
        </p>
      )}
    </section>
  );
}

export default function CoAuthorGlobalSection({
  profile: g,
  odsReferentLayout = false,
  odsSdgNum,
  odsMetrics,
  showTopWorks = true,
}: CoAuthorGlobalSectionProps) {
  const [viewMode, setViewMode] = useState<ProductionViewMode>('list');
  const [sortBy, setSortBy] = useState<SortKey>('citations');
  const [pubSearch, setPubSearch] = useState('');
  const mappedWorks = g.top_works.map(mapGlobalTopWork);

  const displayWorks = useMemo(() => {
    let list = mappedWorks;
    const q = pubSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((w) => stripTags(w.t).toLowerCase().includes(q));
    }
    return sortWorks(list, sortBy);
  }, [mappedWorks, pubSearch, sortBy]);

  if (odsReferentLayout) {
    return (
      <OdsReferentGlobalSection
        g={g}
        odsSdgNum={odsSdgNum}
        odsMetrics={odsMetrics}
      />
    );
  }

  const traj = g.trajectory.slice(-7);
  const trendData = {
    years: traj.map((t) => String(t.year)),
    pubs: traj.map((t) => t.works),
    cumCits: traj.map((t) => t.cum_cits),
    maxPub: Math.max(1, ...traj.map((t) => t.works)),
    maxCit: Math.max(1, ...traj.map((t) => t.cum_cits)),
  };
  const qp = g.cuartiles;

  return (
    <section className="coauthor-section coauthor-global">
      <div className="coauthor-zone-label">
        <span>🌐 Perfil global del investigador</span>
      </div>

      <div className="coauthor-global__kpis">
        <div className="cg-kpi">
          <div className="cg-kpi__n">{g.works_count}</div>
          <div className="cg-kpi__l">Obras</div>
        </div>
        <div className="cg-kpi">
          <div className="cg-kpi__n">{g.cited_by_count.toLocaleString('es')}</div>
          <div className="cg-kpi__l">Citas</div>
        </div>
        <div className="cg-kpi">
          <div className="cg-kpi__n">{g.h_index ?? '—'}</div>
          <div className="cg-kpi__l">H-index</div>
        </div>
        {g.fwci_mean != null && (
          <div className="cg-kpi">
            <div className="cg-kpi__n cg-kpi__n--green">{g.fwci_mean.toLocaleString('es')}×</div>
            <div className="cg-kpi__l">FWCI</div>
          </div>
        )}
      </div>

      <div className="coauthor-global__grid">
        <div className="cg-card">
          {qp && qp.with_quartile > 0 && (
            <>
              <p className="cg-sublabel">Cuartiles SJR</p>
              <div className="researcher-quartile-bar">
                {[
                  { q: 'Q1', c: 'var(--q1)', n: qp.Q1 || 0 },
                  { q: 'Q2', c: 'var(--q2)', n: qp.Q2 || 0 },
                  { q: 'Q3', c: 'var(--q3)', n: qp.Q3 || 0 },
                  { q: 'Q4', c: 'var(--q4)', n: qp.Q4 || 0 },
                ].map(({ q, c, n }) => {
                  const pct = qp.with_quartile ? (n / qp.with_quartile) * 100 : 0;
                  return pct > 0 ? (
                    <div
                      key={q}
                      style={{
                        width: `${pct}%`,
                        background: c,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 8,
                        fontWeight: 700,
                        color: '#fff',
                      }}
                    >
                      {pct > 3 ? q : ''}
                    </div>
                  ) : null;
                })}
              </div>
            </>
          )}

          <p className="researcher-impact__sublabel">Citación de élite · percentil mundial</p>
          <div className="researcher-elite">
            <div className="researcher-elite__tile researcher-elite__tile--top10">
              <div className="researcher-elite__num">{g.elite.top10}</div>
              <div className="researcher-elite__lbl">
                en el <strong>top 10%</strong> · {g.elite.top10} de {g.elite.total}
              </div>
            </div>
            <div className="researcher-elite__tile researcher-elite__tile--top1">
              <div className="researcher-elite__num">{g.elite.top1}</div>
              <div className="researcher-elite__lbl">
                en el <strong>top 1%</strong> · {g.elite.top1} de {g.elite.total}
              </div>
            </div>
          </div>

          {g.oa.segments.length > 0 && (
            <>
              <div className="researcher-impact__divider" />
              <div className="researcher-oa-head">
                <span className="researcher-impact__sublabel" style={{ margin: 0 }}>
                  Acceso abierto
                </span>
                <span className="researcher-oa-head__pct">{g.oa.pct}%</span>
              </div>
              <div className="researcher-oa-bar">
                {g.oa.segments.map((s) => (
                  <div
                    key={s.key}
                    style={{ flex: s.count, background: s.color }}
                    title={`${s.label}: ${s.count} (${s.pct}%)`}
                  />
                ))}
              </div>
              <div className="researcher-oa-legend">
                {g.oa.segments.map((s) => (
                  <span key={s.key} className="researcher-oa-legend__item">
                    <span className="researcher-oa-legend__dot" style={{ background: s.color }} />
                    {s.label} {s.pct}%
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="cg-card cg-card--trend">
          <p className="cg-sublabel">Producción e impacto en el tiempo</p>
          <TrendChart data={trendData} />
          <div className="researcher-trend__legend">
            <span>
              <span className="dot dot--bar" /> Publicaciones/año
            </span>
            <span>
              <span className="dot dot--line" /> Citas acumuladas (carrera)
            </span>
          </div>
        </div>
      </div>

      {g.scope.total > 0 && (
        <div className="coauthor-global__scope">
          <p className="cg-sublabel">Colaboración por alcance (carrera)</p>
          <div className="researcher-scope">
            <div className="researcher-scope__tile">
              <div className="researcher-scope__num">{g.scope.intl}%</div>
              <div className="researcher-scope__lbl">Internacional</div>
            </div>
            <div className="researcher-scope__tile">
              <div className="researcher-scope__num">{g.scope.natl}%</div>
              <div className="researcher-scope__lbl">Nacional</div>
            </div>
            <div className="researcher-scope__tile">
              <div className="researcher-scope__num">{g.scope.inst}%</div>
              <div className="researcher-scope__lbl">Institucional</div>
            </div>
          </div>
        </div>
      )}

      {showTopWorks && (
        <>
          <div className="cg-prod-head">
            <span className="cg-prod-title">PRODUCCIÓN CIENTÍFICA</span>
            <span className="cg-prod-pill">{g.works_count} obras</span>
            {mappedWorks.length > 0 && (
              <ProductionViewToggle value={viewMode} onChange={setViewMode} />
            )}
          </div>
          <p className="cg-sublabel cg-sublabel--muted">
            Obras más citadas (top {g.top_works.length})
          </p>
          {mappedWorks.length > 0 && (
            <div className="cg-prod-tools">
              <div className="descubridor__sort">
                <label htmlFor="cg-prod-sort" className="descubridor__sort-label">Ordenar por</label>
                <select
                  id="cg-prod-sort"
                  className="descubridor__sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                >
                  <option value="citations">Más citadas</option>
                  <option value="fwci">Mayor FWCI</option>
                  <option value="year">Año (recientes)</option>
                  <option value="quartile">Mejor cuartil</option>
                </select>
              </div>
              <input
                type="search"
                className="prod-sort__search"
                value={pubSearch}
                onChange={(e) => setPubSearch(e.target.value)}
                placeholder="Buscar obra…"
                aria-label="Buscar obra"
              />
            </div>
          )}
          <div className={`coauthor-global__works${viewMode === 'cards' ? ' coauthor-global__works--cards' : ''}`}>
            <ProductionWorkList works={displayWorks} viewMode={viewMode} variant="openalex" />
          </div>
        </>
      )}

      <div className="coauthor-global__foot">
        Perfil de carrera vía OpenAlex · {g.works_count} obras.{' '}
        <a href={g.author_id} target="_blank" rel="noreferrer">
          Ver en OpenAlex ↗
        </a>
      </div>
    </section>
  );
}
