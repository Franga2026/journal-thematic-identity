import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useUI } from '../../context/UIContext';
import type { TabKey } from '../../shared/types';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { Loading } from '../../components/common/UIComponents';
import AppLayout from './AppLayout';

// ─── Lazy-loaded Tabs ───
const TabPerfiles = lazy(() => import('../../components/tabs/TabPerfiles'));
const TabUnidades = lazy(() => import('../../components/tabs/TabUnidades'));
const TabAreas = lazy(() => import('../../components/tabs/TabAreas'));
const TabODS = lazy(() => import('../../components/tabs/TabODS'));
const TabProduccion = lazy(() => import('../../components/tabs/TabProduccion'));
const TabColaboradores = lazy(() => import('../../components/tabs/TabColaboradores'));
const TabRanking = lazy(() => import('../../components/tabs/TabRanking'));
const TabMetricas = lazy(() => import('../../components/tabs/TabMetricas'));
const TabIA = lazy(() => import('../../components/tabs/TabIA'));
const TabInformes = lazy(() => import('../../components/tabs/TabInformes'));

// ─── Lazy-loaded Modals ───
const ResearcherModal = lazy(() => import('../../components/modals/ResearcherModal'));
const CoAuthorModal = lazy(() => import('../../components/modals/CoAuthorModal'));

// ─── Route → Tab mapping ───
const ROUTE_TABS = {
  perfiles: TabPerfiles,
  unidades: TabUnidades,
  areas: TabAreas,
  ods: TabODS,
  produccion: TabProduccion,
  colaboradores: TabColaboradores,
  ranking: TabRanking,
  metricas: TabMetricas,
  ia: TabIA,
  informes: TabInformes,
};

// ─── Tab Page — syncs URL with context ───
function isTabKey(key: string | undefined): key is TabKey {
  return !!key && key in ROUTE_TABS;
}

function TabPage() {
  const { tabKey } = useParams();
  const { setTab } = useUI();

  useEffect(() => {
    if (isTabKey(tabKey)) {
      setTab(tabKey);
    }
  }, [tabKey, setTab]);

  const ActiveTab = isTabKey(tabKey) ? ROUTE_TABS[tabKey] : undefined;
  if (!ActiveTab) return <Navigate to="/perfiles" replace />;

  return (
    <ErrorBoundary key={tabKey} fallbackMessage={`Error al cargar "${tabKey}". Intente nuevamente.`}>
      <Suspense fallback={<Loading message="Cargando sección..." />}>
        <ActiveTab />
      </Suspense>
    </ErrorBoundary>
  );
}

// ─── Modal Layer — renders on top of any tab ───
function ModalLayer() {
  const { selected, viewCoAuthor } = useUI();

  return (
    <ErrorBoundary fallbackMessage="Error al cargar el modal.">
      <Suspense fallback={null}>
        {selected && <ResearcherModal />}
        {viewCoAuthor && <CoAuthorModal />}
      </Suspense>
    </ErrorBoundary>
  );
}

// ─── Router ───
export default function AppRouter() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/:tabKey" element={<TabPage />} />
          <Route path="/" element={<Navigate to="/perfiles" replace />} />
          <Route path="*" element={<Navigate to="/perfiles" replace />} />
        </Routes>
      </AppLayout>
      <ModalLayer />
    </BrowserRouter>
  );
}
