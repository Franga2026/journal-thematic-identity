import { useApp } from '../../context/AppContext';

export default function TabUnidades() {
  const { DEPTS, deptCounts, setDept, setTab, setOnlyOrcid, setSdgFilter, resetPage } = useApp();

  const handleClick = (d) => {
    setDept(d);
    setTab('perfiles');
    setOnlyOrcid(false);
    setSdgFilter('');
    resetPage();
  };

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
