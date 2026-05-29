import { Suspense, lazy, useEffect } from 'react';
import { startTransition } from 'react';
import { useParams } from 'react-router-dom';
import { useUI } from '../../context/UIContext';
import { Loading } from '../../components/common/UIComponents';
import ErrorBoundary from '../../components/common/ErrorBoundary';

const TabPerfiles = lazy(() => import('../../components/tabs/TabPerfiles'));

/**
 * /perfiles/:profileId — lista de perfiles + ficha (modal) según RUT/ORCID/OpenAlex ID.
 */
export default function ResearcherProfileRoute() {
  const { profileId } = useParams();
  const { setTab, resolveResearcherProfile } = useUI();

  useEffect(() => {
    startTransition(() => {
      setTab('perfiles');
    });
  }, [setTab]);

  useEffect(() => {
    if (!profileId) return;
    resolveResearcherProfile(decodeURIComponent(profileId));
  }, [profileId, resolveResearcherProfile]);

  return (
    <ErrorBoundary fallbackMessage="Error al cargar perfiles.">
      <Suspense fallback={<Loading message="Cargando perfiles..." />}>
        <TabPerfiles />
      </Suspense>
    </ErrorBoundary>
  );
}
