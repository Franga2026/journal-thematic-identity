import { useCallback } from 'react';
import { useTransitionNavigate } from '../../app/hooks/useTransitionNavigate';
import { useApp } from '../../context/AppContext';

export default function TabUnidades() {
  const {
    DEPTS,
    deptCounts,
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

  return (
    <>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 14px' }}>Unidades de Investigación</h2>
      <div className="grid grid--units">
        {DEPTS.map((d) => (
          <div
            key={d}
            className="card unit-card"
            onClick={() => handleClick(d)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleClick(d)}
          >
            <div>
              <div className="unit-card__name">{d}</div>
              <div className="unit-card__count">{deptCounts[d] || 0} investigadores</div>
            </div>
            <div className="unit-card__badge">{deptCounts[d] || 0}</div>
          </div>
        ))}
      </div>
    </>
  );
}
