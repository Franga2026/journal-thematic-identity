import { useMemo } from 'react';
import type { OpenAlexAuthorDetail } from '../../shared/types/openalex';
import {
  buildOpenAlexMetricTiles,
  computeAuthorKpis,
  type AuthorWorkLite,
} from '../../services/discovery/computeOpenAlexAuthorKpis';

const PRIMARY_KEYS = ['output', 'cites', 'h_index'] as const;
const SECONDARY_KEYS = ['fwci', 'cpp', 'datasets', 'oa_rate'] as const;

function parseFwciValue(value: string): number | null {
  if (value === '—') return null;
  const n = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function OpenAlexKpiTile({
  tile,
  primary,
}: {
  tile: { key: string; label: string; value: string; hint: string | null };
  primary?: boolean;
}) {
  const muted = tile.value === '—';
  const fwciVal = tile.key === 'fwci' ? parseFwciValue(tile.value) : null;
  const fwciOk = fwciVal != null && fwciVal >= 1;

  return (
    <div
      className="researcher-kpi researcher-kpi--static"
      title={tile.hint || undefined}
    >
      <div
        className={[
          'researcher-kpi__value',
          muted ? 'researcher-kpi__value--muted' : '',
          !primary && fwciOk ? 'researcher-kpi__value--fwci-ok' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {tile.value}
      </div>
      <div className="researcher-kpi__label">{tile.label}</div>
      {tile.hint && <div className="researcher-kpi__sub">{tile.hint}</div>}
    </div>
  );
}

export default function OpenAlexAuthorKpiTiles({
  author,
  sampledWorks,
  loading = false,
}: {
  author: OpenAlexAuthorDetail;
  sampledWorks: AuthorWorkLite[];
  loading?: boolean;
}) {
  const kpis = useMemo(
    () => computeAuthorKpis(author, sampledWorks),
    [author, sampledWorks],
  );
  const tiles = useMemo(() => buildOpenAlexMetricTiles(kpis), [kpis]);
  const byKey = useMemo(
    () => Object.fromEntries(tiles.map((t) => [t.key, t])),
    [tiles],
  );

  if (loading && sampledWorks.length === 0) {
    return (
      <section className="researcher-section" aria-labelledby="openalex-kpi-label">
        <h3 id="openalex-kpi-label" className="researcher-section__label">
          Indicadores
        </h3>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Calculando KPIs desde OpenAlex…</p>
      </section>
    );
  }

  return (
    <section className="researcher-section" aria-labelledby="openalex-kpi-label">
      <h3 id="openalex-kpi-label" className="researcher-section__label">
        Indicadores
      </h3>
      <div className="researcher-kpi-grid researcher-kpi-grid--primary">
        {PRIMARY_KEYS.map((key) => (
          <OpenAlexKpiTile key={key} tile={byKey[key]} primary />
        ))}
      </div>
      <div className="researcher-kpi-grid researcher-kpi-grid--secondary openalex-kpi-grid--4">
        {SECONDARY_KEYS.map((key) => (
          <OpenAlexKpiTile key={key} tile={byKey[key]} />
        ))}
      </div>
      {kpis.distinctions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {kpis.distinctions.map((d) => (
            <span key={d} className="badge badge--field">{d}</span>
          ))}
        </div>
      )}
      <p style={{ fontSize: 11, color: '#94a3b8', margin: '12px 0 0' }}>
        KPIs desde OpenAlex en vivo. FWCI y acceso abierto sobre muestra de hasta{' '}
        {kpis.worksSampled.toLocaleString('es-CL')} obras (sin percentiles UTA).
      </p>
    </section>
  );
}
