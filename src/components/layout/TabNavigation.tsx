import { useNavigate, useLocation } from 'react-router-dom';
import { TABS } from '../../utils/constants';

export default function TabNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const currentTab = pathname.replace('/', '') || 'perfiles';

  return (
    <nav className="tab-nav" role="tablist" aria-label="Secciones del directorio">
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          role="tab"
          aria-selected={currentTab === key}
          aria-controls={`panel-${key}`}
          className={`tab-nav__btn ${currentTab === key ? 'tab-nav__btn--active' : ''}`}
          onClick={() => navigate(`/${key}`)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
