import { useCallback } from 'react';
import { useTransitionNavigate } from '../../app/hooks/useTransitionNavigate';
import { useApp } from '../../context/AppContext';

export default function TabUnidades() {
  const {
    DEPTS,
    deptCounts,
    deptOrcid,
    setDept,
    setOnlyOrcid,
    setSdgFilter,
    setAreaFilter,
    resetPage,
  } = useApp();
  const navigate = useTransitionNavigate();

  const handleClick = useCallback(
    (unitName: string) => {
      setDept(unitName);
      setOnlyOrcid(false);
      setSdgFilter('');
      setAreaFilter('');
      resetPage();
      navigate('/perfiles');
    },
    [setDept, setOnlyOrcid, setSdgFilter, setAreaFilter, resetPage, navigate]
  );

  const orcidColor = (pct: number) =>
    pct >= 70 ? '#15803D' : pct >= 40 ? '#D97706' : '#B5482F';

  const totalInv = DEPTS.reduce((s, d) => s + (deptCounts[d] || 0), 0);
  const totalOrcid = DEPTS.reduce((s, d) => s + (deptOrcid[d]?.conOrcid || 0), 0);
  const pctGlobal = totalInv ? Math.round((100 * totalOrcid) / totalInv) : 0;

  return (
    <>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 14px' }}>Unidades de Investigación</h2>
      <p className="units-lead">
        {DEPTS.length} unidades · {totalInv} investigadores ·{' '}
        <b>{pctGlobal}% con ORCID registrado</b>
      </p>
      <div className="grid grid--units">
        {DEPTS.map((d) => {
          const total = deptCounts[d] || 0;
          const cov = deptOrcid[d];
          const pct = cov?.pct ?? 0;
          return (
            <div
              key={d}
              className="card unit-card"
              onClick={() => handleClick(d)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleClick(d);
              }}
            >
              <div className="unit-card__name">{d}</div>
              <div className="unit-card__count">
                {total} investigadores
                {cov && (
                  <>
                    {' · '}
                    <span
                      className="unit-card__orcid"
                      style={{ color: orcidColor(pct) }}
                    >
                      {pct}% ORCID
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="units-legend">
        <span><i className="dot" style={{ background: '#15803D' }} />Alta cobertura (≥70%)</span>
        <span><i className="dot" style={{ background: '#D97706' }} />Media (40–69%)</span>
        <span><i className="dot" style={{ background: '#B5482F' }} />Baja (&lt;40%)</span>
      </p>
    </>
  );
}
