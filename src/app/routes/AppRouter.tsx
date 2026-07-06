import { Suspense, lazy, useEffect } from 'react';
import { startTransition } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useUI } from '../../context/UIContext';
import type { TabKey } from '../../shared/types';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { Loading } from '../../components/common/UIComponents';
import AppLayout from './AppLayout';
import DescubridorUniversalLayout from './DescubridorUniversalLayout';

const TabPerfiles = lazy(() => import('../../components/tabs/TabPerfiles'));
const ResearcherProfileRoute = lazy(() => import('./ResearcherProfileRoute'));
const TabUnidades = lazy(() => import('../../components/tabs/TabUnidades'));
const TabAreas = lazy(() => import('../../components/tabs/TabAreas'));
const TabODS = lazy(() => import('../../components/tabs/TabODS'));
const OdsDetailView = lazy(() => import('../../components/ods/OdsDetailView'));
const TabProduccion = lazy(() => import('../../components/tabs/TabProduccion'));
const TabDescubridor = lazy(() => import('../../components/tabs/TabDescubridor'));
const TabRanking = lazy(() => import('../../components/tabs/TabRanking'));
const TabMetricas = lazy(() => import('../../components/tabs/TabMetricas'));
const TabInformes = lazy(() => import('../../components/tabs/TabInformes'));
const TabFuentes = lazy(() => import('../../components/tabs/TabFuentes'));

const ResearcherModal = lazy(() => import('../../components/modals/ResearcherModal'));
const CoAuthorModal = lazy(() => import('../../components/modals/CoAuthorModal'));

const ROUTE_TABS = {
  perfiles: TabPerfiles,
  unidades: TabUnidades,
  areas: TabAreas,
  ods: TabODS,
  produccion: TabProduccion,
  descubridor: TabDescubridor,
  ranking: TabRanking,
  metricas: TabMetricas,
  informes: TabInformes,
  fuentes: TabFuentes,
};

function OdsDetailRoute() {
  const { setTab } = useUI();
  useEffect(() => {
    startTransition(() => {
      setTab('ods');
    });
  }, [setTab]);
  return (
    <ErrorBoundary fallbackMessage="Error al cargar el detalle del ODS.">
      <Suspense fallback={<Loading message="Cargando ODS…" />}>
        <OdsDetailView />
      </Suspense>
    </ErrorBoundary>
  );
}

function ResearcherProfileRouteWrapper() {
  return (
    <ErrorBoundary fallbackMessage="Error al cargar el perfil del investigador.">
      <Suspense fallback={<Loading message="Cargando perfil…" />}>
        <ResearcherProfileRoute />
      </Suspense>
    </ErrorBoundary>
  );
}

function isTabKey(key: string | undefined): key is TabKey {
  return !!key && key in ROUTE_TABS;
}

function TabPage() {
  const { tabKey } = useParams();
  const { setTab } = useUI();

  useEffect(() => {
    if (isTabKey(tabKey)) {
      startTransition(() => {
        setTab(tabKey);
      });
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

function ModalLayer() {
  const { selected, openAlexAuthorId, viewCoAuthor } = useUI();
  const showResearcher = Boolean(selected || openAlexAuthorId);

  return (
    <ErrorBoundary fallbackMessage="Error al cargar el modal.">
      {showResearcher && (
        <Suspense fallback={<Loading message="Cargando perfil…" />}>
          <ResearcherModal />
        </Suspense>
      )}
      {viewCoAuthor && (
        <Suspense fallback={null}>
          <CoAuthorModal />
        </Suspense>
      )}
    </ErrorBoundary>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true }}>
      <Routes>
        <Route path="/descubrir" element={
          <ErrorBoundary fallbackMessage="Error al cargar el descubridor universal.">
            <Suspense fallback={<Loading message="Cargando descubridor…" />}>
              <DescubridorUniversalLayout />
            </Suspense>
          </ErrorBoundary>
        } />
        <Route path="*" element={
          <AppLayout>
            <Routes>
              <Route path="/ods/:sdgNum" element={<OdsDetailRoute />} />
              <Route path="/perfiles/:profileId" element={<ResearcherProfileRouteWrapper />} />
              <Route path="/:tabKey" element={<TabPage />} />
              <Route path="/" element={<Navigate to="/perfiles" replace />} />
              <Route path="*" element={<Navigate to="/perfiles" replace />} />
            </Routes>
          </AppLayout>
        } />
      </Routes>
      <ModalLayer />
    </BrowserRouter>
  );
}
