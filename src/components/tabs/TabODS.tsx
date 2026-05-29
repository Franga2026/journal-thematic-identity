import { useTransitionNavigate } from '../../app/hooks/useTransitionNavigate';
import { useApp } from '../../context/AppContext';
import { SDG_COLORS, SDG_ES, SDG_NAME_TO_NUMBER } from '../../utils/constants';

export default function TabODS() {
  const { INST } = useApp();
  const navigate = useTransitionNavigate();

  const handleClick = (name: string) => {
    const num = SDG_NAME_TO_NUMBER[name as keyof typeof SDG_NAME_TO_NUMBER];
    if (num) navigate(`/ods/${num}`);
  };

  return (
    <>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>
        Objetivos de Desarrollo Sostenible
      </h2>
      <p style={{ fontSize: 13, color: '#666', margin: '0 0 14px' }}>
        Contribuciones reales de investigadores UTA según OpenAlex. Haga clic para ver los
        investigadores vinculados.
      </p>
      <div className="grid grid--ods">
        {(INST.sdgs || []).map((s, i) => {
          const c = SDG_COLORS[s.name] || '#333';
          const es = SDG_ES[s.name] || s.name;
          return (
            <div
              key={i}
              className="ods-card"
              style={{ background: c }}
              onClick={() => handleClick(s.name)}
              role="button"
              tabIndex={0}
              aria-label={`${es}: ${s.count} publicaciones`}
              onKeyDown={(e) => e.key === 'Enter' && handleClick(s.name)}
            >
              <div className="ods-card__name">{es}</div>
              <div className="ods-card__count">{s.count}</div>
              <div className="ods-card__label">publicaciones</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
