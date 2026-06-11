import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { RankKey } from '../../shared/types';
import { getData, getAuthorOA } from '../../utils/dataProcessing';
import { getColor, getInitials, shortDept } from '../../utils/helpers';
import { RANK_OPTIONS, MIN_FWCI_WORKS, MIN_QUARTILE_WORKS } from '../../utils/constants';
import { formatQuartilePct, isQuartileRankEligible } from '../../utils/quartileDisplay';

const MIN_PUBS = 10;
const NO_DATA = '—';

export default function TabRanking() {
  const { rankBy, setRankBy, openResearcher } = useApp();
  const DATA = getData();

  const labels = Object.fromEntries(Object.entries(RANK_OPTIONS).map(([k, v]) => [k, v.label]));
  const descs = Object.fromEntries(Object.entries(RANK_OPTIONS).map(([k, v]) => [k, v.desc]));

  const sorted = useMemo(() => {
    const ranked = DATA.filter((r) => r.o).map((r) => {
      const oa = getAuthorOA(r);
      const qp = oa?.quartile_profile || {};
      const wc = oa?.works_count ?? null;
      const cc = oa?.cited_by_count ?? null;
      const withQuartile = qp.with_quartile ?? 0;
      const q1Pct = typeof qp.q1_pct === 'number' ? qp.q1_pct : null;
      return {
        ...r,
        wc,
        cc,
        hi: oa?.h_index ?? null,
        fwci: oa?.fwci ?? null,
        fwciN: oa?.fwciN ?? 0,
        withQuartile,
        q1p: q1Pct,
        q1Eligible: isQuartileRankEligible(qp) && q1Pct != null,
        oar: oa?.oaRate ?? null,
        cpp: wc != null && wc > 0 && cc != null ? +(cc / wc).toFixed(1) : null,
      };
    });

    const filtered = ranked.filter(
      (r) =>
        (r.wc ?? 0) >= MIN_PUBS &&
        (rankBy === 'fwci'
          ? r.fwci != null && r.fwciN >= MIN_FWCI_WORKS
          : rankBy === 'q1'
            ? r.q1Eligible
            : true)
    );

    const sortFn: Record<RankKey, (a: (typeof ranked)[0], b: (typeof ranked)[0]) => number> = {
      fwci: (a, b) => (b.fwci ?? 0) - (a.fwci ?? 0),
      hindex: (a, b) => (b.hi ?? 0) - (a.hi ?? 0),
      citas: (a, b) => (b.cc ?? 0) - (a.cc ?? 0),
      q1: (a, b) => (b.q1p ?? 0) - (a.q1p ?? 0),
      cpp: (a, b) => (b.cpp ?? 0) - (a.cpp ?? 0),
      oa: (a, b) => {
        if (a.oar == null && b.oar == null) return 0;
        if (a.oar == null) return 1;
        if (b.oar == null) return -1;
        return b.oar - a.oar;
      },
    };

    return [...filtered].sort(sortFn[rankBy] || (() => 0));
  }, [DATA, rankBy]);

  const fwciColor = (v: number | null) =>
    v == null ? 'var(--gray-400)' : v >= 2 ? '#166534' : v >= 1 ? '#22c55e' : v >= 0.8 ? '#f59e0b' : '#ef4444';

  const thresholdNote =
    rankBy === 'fwci'
      ? `Mínimo ${MIN_PUBS} publicaciones y ${MIN_FWCI_WORKS} obras con FWCI.`
      : rankBy === 'q1'
        ? `Mínimo ${MIN_PUBS} publicaciones y ${MIN_QUARTILE_WORKS} obras con cuartil SJR.`
        : `Mínimo ${MIN_PUBS} publicaciones.`;

  return (
    <>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>Ranking de Investigadores</h2>
      <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: '0 0 14px' }}>
        Indicadores bibliométricos — {labels[rankBy]}
      </p>

      {/* Rank selector */}
      <div className="btn-group" style={{ marginBottom: 12 }}>
        {Object.entries(labels).map(([k, v]) => (
          <button key={k} onClick={() => setRankBy(k as RankKey)}
            className={`btn ${rankBy === k ? 'btn--primary' : 'btn--ghost'}`}
            style={{ fontSize: 12 }}>
            {v}
          </button>
        ))}
      </div>

      {/* Description */}
      <div style={{ background: 'var(--blue-100)', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: 'var(--blue-800)', marginBottom: 14, border: '1px solid #bfdbfe' }}>
        {descs[rankBy]} {thresholdNote}
      </div>

      {/* Table */}
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Investigador</th>
            <th>Unidad</th>
            <th style={{ textAlign: 'right' }}>Pubs</th>
            <th style={{ textAlign: 'right' }}>Citas</th>
            <th style={{ textAlign: 'right' }}>h</th>
            <th style={{ textAlign: 'right', color: rankBy === 'fwci' ? 'var(--blue-800)' : undefined, fontWeight: rankBy === 'fwci' ? 700 : undefined }}>FWCI</th>
            <th style={{ textAlign: 'right', color: rankBy === 'q1' ? 'var(--blue-800)' : undefined, fontWeight: rankBy === 'q1' ? 700 : undefined }}>Q1%</th>
            <th style={{ textAlign: 'right', color: rankBy === 'oa' ? 'var(--blue-800)' : undefined, fontWeight: rankBy === 'oa' ? 700 : undefined }}>OA%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 50).map((r, i) => {
            const c = getColor((r.f || '') + (r.l || ''));
            return (
              <tr key={i} data-clickable onClick={() => openResearcher(r)}>
                <td style={{ fontWeight: i < 3 ? 700 : 400, color: i < 3 ? '#E5243B' : '#888' }}>{i + 1}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {r.ph ? (
                      <img src={`/photos/${r.ph}`} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: 12 }}>
                        {getInitials(r.f, r.l)}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.f} {r.l}</div>
                      {r.t && <div style={{ fontSize: 10, color: '#888' }}>{r.t}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: 11, color: '#888' }}>{shortDept((r.dp || [])[0]?.d || '')}</td>
                <td style={{ textAlign: 'right' }}>{r.wc != null ? r.wc.toLocaleString() : NO_DATA}</td>
                <td style={{ textAlign: 'right' }}>{r.cc != null ? r.cc.toLocaleString() : NO_DATA}</td>
                <td style={{ textAlign: 'right' }}>
                  {r.hi != null ? (
                    <span className="badge badge--sm badge--cites">{r.hi}</span>
                  ) : (
                    NO_DATA
                  )}
                </td>
                <td style={{ textAlign: 'right', color: fwciColor(r.fwci), fontWeight: 700, fontSize: 13 }}>
                  {r.fwci != null && r.fwci > 0 ? r.fwci.toFixed(2) : NO_DATA}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {r.q1Eligible && r.q1p != null ? formatQuartilePct(r.q1p) : NO_DATA}
                </td>
                <td style={{ textAlign: 'right', color: r.oar != null ? 'var(--green-600)' : 'var(--gray-400)' }}>
                  {r.oar != null ? r.oar + '%' : NO_DATA}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ marginTop: 12, fontSize: 10, color: 'var(--gray-400)', textAlign: 'right' }}>
        Indicadores bibliométricos · Fuente: OpenAlex
      </div>
    </>
  );
}
