import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useOpenResearcherProfile } from '../../app/hooks/useOpenResearcherProfile';
import { findResearcherByProfileId } from '../../utils/researcherProfile';
import { getData } from '../../utils/dataProcessing';
import { resolveSdgFromRoute } from '../../utils/sdgNormalize';
import { clearSdgRankingCache } from '../../services/sdg/cache';
import { getAllOdsRankings } from '../../services/sdg/getResearchersBySdg';
import type { SdgRankedResearcher, SdgResearchersApiResponse } from '../../shared/types/sdgResearcher';
import OdsResearcherCard from './OdsResearcherCard';
import { Loading, EmptyState } from '../common/UIComponents';

export type OdsResearchersTab = 'uta' | 'ibero' | 'global';

interface OdsResearchersPanelProps {
  sdgName: string;
  sdgNum: number;
  activeTab: OdsResearchersTab;
}

type TabState = {
  rows: SdgRankedResearcher[];
  loading: boolean;
  error: string | null;
  emptyMessage: string | null;
  emptyTitle: string;
  worksFetched?: number;
  loaded: boolean;
};

function emptyTitleForReason(reason?: string): string {
  switch (reason) {
    case 'no_publications':
      return 'Sin publicaciones ODS en repositorio';
    case 'no_authorships':
      return 'Publicaciones sin autores vinculados';
    case 'authors_filtered_out':
      return 'Autores filtrados por ámbito';
    case 'openalex_fallback_failed':
      return 'Error al consultar OpenAlex';
    default:
      return 'Sin investigadores en este ranking';
  }
}

function applyResponse(res: SdgResearchersApiResponse): TabState {
  return {
    rows: res.researchers,
    loading: false,
    error: null,
    emptyMessage:
      res.researchers.length > 0
        ? null
        : res.empty_message || 'No hay investigadores para este ámbito.',
    emptyTitle: emptyTitleForReason(res.empty_reason),
    worksFetched: res.total_works_fetched,
    loaded: true,
  };
}

const INITIAL_TAB: TabState = {
  rows: [],
  loading: false,
  error: null,
  emptyMessage: null,
  emptyTitle: 'Sin investigadores en este ranking',
  loaded: false,
};

export default function OdsResearchersPanel({
  sdgName,
  sdgNum: sdgNumProp,
  activeTab,
}: OdsResearchersPanelProps) {
  const { sdgNum: sdgNumRoute } = useParams();
  const { openLocalResearcherProfile, openOpenAlexProfile } = useOpenResearcherProfile();

  const sdgContext = useMemo(
    () =>
      resolveSdgFromRoute(sdgNumRoute) ??
      (sdgNumProp >= 1 && sdgNumProp <= 17
        ? resolveSdgFromRoute(String(sdgNumProp))
        : null),
    [sdgNumRoute, sdgNumProp]
  );

  const sdgId = sdgContext?.sdgNum ?? NaN;

  const [utaState, setUtaState] = useState<TabState>(INITIAL_TAB);
  const [iberoState, setIberoState] = useState<TabState>(INITIAL_TAB);
  const [globalState, setGlobalState] = useState<TabState>(INITIAL_TAB);

  useEffect(() => {
    if (!Number.isFinite(sdgId)) return;

    clearSdgRankingCache();
    setUtaState({ ...INITIAL_TAB, loading: true });
    setIberoState({ ...INITIAL_TAB, loading: true });
    setGlobalState({ ...INITIAL_TAB, loading: true });

    let cancelled = false;

    getAllOdsRankings(sdgId)
      .then(({ local, ibero, global }) => {
        if (cancelled) return;
        setUtaState(applyResponse(local));
        setIberoState(applyResponse(ibero));
        setGlobalState(applyResponse(global));
      })
      .catch((err: Error) => {
        if (cancelled) return;
        const msg = err.message || 'Error al calcular rankings ODS';
        const errState: TabState = {
          rows: [],
          loading: false,
          error: msg,
          emptyMessage: null,
          emptyTitle: 'Error al consultar ranking',
          loaded: true,
        };
        setUtaState(errState);
        setIberoState(errState);
        setGlobalState(errState);
      });

    return () => {
      cancelled = true;
    };
  }, [sdgId, sdgName]);

  const openProfile = (row: SdgRankedResearcher) => {
    if (row.region_scope === 'local' && row.uta_researcher_id) {
      const local = findResearcherByProfileId(getData(), row.uta_researcher_id);
      if (local) {
        openLocalResearcherProfile(local);
        return;
      }
    }
    openOpenAlexProfile({
      id: row.author_openalex_id,
      openAlexId: row.author_openalex_id,
      display_name: row.author_name,
      orcid: row.orcid,
      works_count: row.publications_count,
      cited_by_count: row.citations_count,
      h_index: row.h_index_sdg,
      institution: row.institution_name,
      country_code: row.country_code,
    });
  };

  const renderUtaResearchersList = (state: TabState, loadingLabel: string) => {
    if (!Number.isFinite(sdgId)) {
      return (
        <EmptyState
          icon="⚠️"
          title="ODS no válido"
          message={`Ruta sdgNum=${String(sdgNumRoute)}. Use /ods/12 (parámetro sdgNum, no sdgId).`}
        />
      );
    }

    if (state.loading || (!state.loaded && !state.error)) {
      return <Loading message={loadingLabel} />;
    }
    if (state.error) {
      return <EmptyState icon="⚠️" title="Error al consultar investigadores" message={state.error} />;
    }
    if (state.emptyMessage) {
      return <EmptyState icon="📭" title={state.emptyTitle} message={state.emptyMessage} />;
    }

    const catalog = getData();
    const assignedTotal = state.rows.reduce((s, r) => s + r.publications_count, 0);

    return (
      <>
        <p className="ods-uta-summary">
          {state.rows.length.toLocaleString()} investigadores UTA ·{' '}
          <strong>{assignedTotal.toLocaleString()}</strong> artículos asignados en este ODS
          {state.worksFetched != null ? ` (${state.worksFetched.toLocaleString()} publicaciones en repositorio)` : ''}
        </p>
        <div className="ods-uta-researcher-list">
          {state.rows.map((row) => {
            const local =
              row.uta_researcher_id != null
                ? findResearcherByProfileId(catalog, row.uta_researcher_id)
                : undefined;
            return (
              <OdsResearcherCard
                key={row.id}
                variant="uta"
                row={row}
                researcher={local}
                onClick={() => openProfile(row)}
              />
            );
          })}
        </div>
      </>
    );
  };

  const renderRankingList = (state: TabState, loadingLabel: string) => {
    if (!Number.isFinite(sdgId)) {
      return (
        <EmptyState
          icon="⚠️"
          title="ODS no válido"
          message={`Ruta sdgNum=${String(sdgNumRoute)}. Use /ods/12 (parámetro sdgNum, no sdgId).`}
        />
      );
    }

    if (state.loading || (!state.loaded && !state.error)) {
      return <Loading message={loadingLabel} />;
    }
    if (state.error) {
      return <EmptyState icon="⚠️" title="Error al consultar ranking" message={state.error} />;
    }
    if (state.emptyMessage) {
      return <EmptyState icon="📭" title={state.emptyTitle} message={state.emptyMessage} />;
    }
    return (
      <div className="ods-researcher-list">
        {state.rows.map((row) => (
          <OdsResearcherCard
            key={row.id}
            variant="ranking"
            row={row}
            onClick={() => openProfile(row)}
          />
        ))}
      </div>
    );
  };

  if (activeTab === 'uta') {
    return renderUtaResearchersList(utaState, `Investigadores UTA · ${sdgName}…`);
  }
  if (activeTab === 'ibero') {
    return renderRankingList(iberoState, `Top 10 Iberoamérica · ${sdgName}…`);
  }
  return renderRankingList(globalState, `Top 10 Global · ${sdgName}…`);
}
