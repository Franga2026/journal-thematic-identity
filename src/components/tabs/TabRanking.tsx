import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { RankKey } from '../../shared/types';
import { getData, getAuthorOA, getResMetrics } from '../../utils/dataProcessing';
import { getColor, getInitials, shortDept, cleanOrcid } from '../../utils/helpers';
import { RANK_OPTIONS } from '../../utils/constants';

export default function TabRanking() {
  const { rankBy, setRankBy, openResearcher } = useApp();
  const DATA = getData();
  const RES_METRICS = getResMetrics();

  const labels = Object.fromEntries(Object.entries(RANK_OPTIONS).map(([k, v]) => [k, v.label]));
  const descs = Object.fromEntries(Object.entries(RANK_OPTIONS).map(([k, v]) => [k, v.desc]));

  const sorted = useMemo(() => {
    const minPubs = 10;
    const ranked = DATA.filter(r => r.o).map(r => {
      const oa = getAuthorOA(r);
      const rm = RES_METRICS[cleanOrcid(r.o)] || {};
      const qp = rm.quartile_profile || {};
      const wc = oa?.works_count || rm.scholarly_output || 0;
      const cc = oa?.cited_by_count || rm.citation_count || 0;
      return {
        ...r, wc, cc,
        hi: oa?.h_index || rm.h_index || 0,
        fwci: rm.fwci || 0,
        q1p: qp.q1_pct || 0,
        oar: rm.oa_rate || 0,
        cpp: wc > 0 ? +(cc / wc).toFixed(1) : 0,
      };
    });

    const filtered = ranked.filter(r =>
      r.wc >= minPubs &&
      (rankBy === 'fwci' ? r.fwci > 0 : rankBy === 'q1' ? r.q1p > 0 : true)
    );

    const sortFn = {
      fwci: (a, b) => b.fwci - a.fwci,
      hindex: (a, b) => b.hi - a.hi,
      citas: (a, b) => b.cc - a.cc,
      q1: (a, b) => b.q1p - a.q1p,
      cpp: (a, b) => b.cpp - a.cpp,
      oa: (a, b) => b.oar - a.oar,
    };

    return [...filtered].sort(sortFn[rankBy] || (() => 0));
  }, [DATA, RES_METRICS, rankBy]);

  const fwciColor = (v) => v >= 2 ? '#166534' : v >= 1 ? '#22c55e' : v >= 0.8 ? '#f59e0b' : '#ef4444';

  return (
    <>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>Ranking de Investigadores</h2>
      <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: '0 0 14px' }}>
        Indicadores bibliométricos normalizados — {labels[rankBy]}
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
        {descs[rankBy]} Mínimo 10 publicaciones.
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
            <th style={{ textAlign: 'right', color: rankBy === 'fwci' ? 'var(--blue-800)' : undefined, fontWeight: rankBy === 'fwci' ? 700 : undefined }}>FNCI</th>
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
                <td style={{ textAlign: 'right' }}>{r.wc.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{r.cc.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className="badge badge--sm badge--cites">{r.hi}</span>
                </td>
                <td style={{ textAlign: 'right', color: fwciColor(r.fwci), fontWeight: 700, fontSize: 13 }}>{r.fwci > 0 ? r.fwci : '—'}</td>
                <td style={{ textAlign: 'right' }}>{r.q1p > 0 ? r.q1p + '%' : '—'}</td>
                <td style={{ textAlign: 'right', color: 'var(--green-600)' }}>{r.oar > 0 ? r.oar + '%' : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ marginTop: 12, fontSize: 10, color: 'var(--gray-400)', textAlign: 'right' }}>
        Indicadores bibliométricos normalizados · Fuente: OpenAlex + Crossref + Unpaywall
      </div>
    </>
  );
}
