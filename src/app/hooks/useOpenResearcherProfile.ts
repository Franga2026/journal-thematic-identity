import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useTransitionNavigate } from './useTransitionNavigate';
import { useUI } from '../../context/UIContext';
import { getData } from '../../utils/dataProcessing';
import {
  findResearcherByProfileId,
  getOpenAlexAuthorProfilePath,
  getResearcherProfilePath,
  shouldSyncProfileRoute,
} from '../../utils/researcherProfile';
import type { OpenAlexAuthorSummary } from '../../shared/types/openalex';
import type { Researcher } from '../../shared/types';

/**
 * Abre la ficha del investigador de forma síncrona (estado UI).
 * Actualiza la URL solo en rutas /perfiles (no al navegar desde ODS u otras secciones).
 */
export function useOpenResearcherProfile() {
  const navigate = useTransitionNavigate();
  const location = useLocation();
  const { openResearcher, openOpenAlexResearcher, openOpenAlexResearcherKeepingPrevious } = useUI();

  const openLocalResearcherProfile = useCallback(
    (researcher: Researcher) => {
      openResearcher(researcher);
      if (shouldSyncProfileRoute(location.pathname)) {
        navigate(getResearcherProfilePath(researcher));
      }
    },
    [openResearcher, navigate, location.pathname]
  );

  const openOpenAlexProfile = useCallback(
    (author: OpenAlexAuthorSummary, options?: { keepPrevious?: boolean }) => {
      const profileId = author.orcid?.trim() || author.openAlexId || author.id;
      const open = options?.keepPrevious
        ? openOpenAlexResearcherKeepingPrevious
        : openOpenAlexResearcher;
      open(profileId, author);
      if (shouldSyncProfileRoute(location.pathname)) {
        navigate(getOpenAlexAuthorProfilePath(author));
      }
    },
    [openOpenAlexResearcher, openOpenAlexResearcherKeepingPrevious, navigate, location.pathname],
  );

  const openProfileById = useCallback(
    (profileId: string) => {
      const key = profileId.trim();
      const local = findResearcherByProfileId(getData(), key);
      if (local) {
        openResearcher(local);
      } else {
        openOpenAlexResearcher(key);
      }
      if (shouldSyncProfileRoute(location.pathname)) {
        navigate(`/perfiles/${encodeURIComponent(key)}`);
      }
    },
    [openResearcher, openOpenAlexResearcher, navigate, location.pathname]
  );

  return { openLocalResearcherProfile, openOpenAlexProfile, openProfileById };
}