import { useLocation } from 'react-router-dom';
import { TABS } from '../../utils/constants';
import { useTransitionNavigate } from '../../app/hooks/useTransitionNavigate';

export default function TabNavigation() {
  const navigate = useTransitionNavigate();
  const { pathname } = useLocation();
  const currentTab = pathname.replace('/', '').split('/')[0] || 'perfiles';

  return (
    <nav className="tab-nav" role="tablist" aria-label="Secciones del directorio">
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
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
