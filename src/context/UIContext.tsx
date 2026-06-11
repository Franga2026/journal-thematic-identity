import { createContext, useContext, useState, useCallback, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import type { Researcher, CoAuthorProfile, TabKey, SearchType, AITabKey, MetricKey, ChatMessage } from '../shared/types';
import type { OpenAlexAuthorSummary } from '../shared/types/openalex';
import { getData } from '../utils/dataProcessing';
import { findResearcherByProfileId, isOpenAlexAuthorId } from '../utils/researcherProfile';

interface UIState {
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  search: string;
  setSearch: (s: string) => void;
  searchType: SearchType;
  setSearchType: (t: SearchType) => void;
  page: number;
  setPage: (p: number) => void;
  resetPage: () => void;
  /** Filtros del Descubridor sincronizados desde Header / chips */
  descubridorQuartile: string;
  setDescubridorQuartile: (q: string) => void;
  descubridorAccess: '' | 'open' | 'closed';
  setDescubridorAccess: (a: '' | 'open' | 'closed') => void;
  selected: Researcher | null;
  openResearcher: (r: Researcher) => void;
  /** ORCID, RUT o OpenAlex A-id para ficha externa (fetch en ResearcherModal) */
  openAlexAuthorId: string | null;
  /** Datos completos del autor externo (de la fila del ranking), para pintar la ficha sin red */
  openAlexAuthor: OpenAlexAuthorSummary | null;
  openOpenAlexResearcher: (authorIdOrUrl: string, summary?: OpenAlexAuthorSummary | null) => void;
  /** Abre ficha UTA o dispara fetch OpenAlex según profileId en URL */
  resolveResearcherProfile: (profileId: string) => void;
  closeResearcher: () => void;
  modalTopic: string;
  setModalTopic: (t: string) => void;
  viewCoAuthor: CoAuthorProfile | null;
  setViewCoAuthor: (c: CoAuthorProfile | null) => void;
  metricDetail: MetricKey | null;
  setMetricDetail: (m: MetricKey | null) => void;
  reportText: string;
  setReportText: (t: string) => void;
  reportLoading: boolean;
  setReportLoading: (l: boolean) => void;
  aiTab: AITabKey;
  setAiTab: (t: AITabKey) => void;
  chatMsgs: ChatMessage[];
  setChatMsgs: Dispatch<SetStateAction<ChatMessage[]>>;
  chatIn: string;
  setChatIn: (s: string) => void;
  chatLoading: boolean;
  setChatLoading: (l: boolean) => void;
  comp1: Researcher | null;
  setComp1: (r: Researcher | null) => void;
  comp2: Researcher | null;
  setComp2: (r: Researcher | null) => void;
  compQ: string;
  setCompQ: (s: string) => void;
  goPerfiles: () => void;
  goOrcid: () => void;
}

const UIContext = createContext<UIState | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<TabKey>('perfiles');
  const [search, setSearch] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('texto');
  const [page, setPage] = useState(0);
  const [descubridorQuartile, setDescubridorQuartile] = useState('');
  const [descubridorAccess, setDescubridorAccess] = useState<'' | 'open' | 'closed'>('');

  const [selected, setSelected] = useState<Researcher | null>(null);
  const [openAlexAuthorId, setOpenAlexAuthorId] = useState<string | null>(null);
  const [openAlexAuthor, setOpenAlexAuthor] = useState<OpenAlexAuthorSummary | null>(null);
  const [modalTopic, setModalTopic] = useState('');
  const [viewCoAuthor, setViewCoAuthor] = useState<CoAuthorProfile | null>(null);
  const [metricDetail, setMetricDetail] = useState<MetricKey | null>(null);
  const [reportText, setReportText] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  const [aiTab, setAiTab] = useState<AITabKey>('chat');
  const [chatMsgs, setChatMsgs] = useState<ChatMessage[]>([]);
  const [chatIn, setChatIn] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [comp1, setComp1] = useState<Researcher | null>(null);
  const [comp2, setComp2] = useState<Researcher | null>(null);
  const [compQ, setCompQ] = useState('');

  const resetPage = useCallback(() => setPage(0), []);
  const openResearcher = useCallback((r: Researcher) => {
    setOpenAlexAuthorId(null);
    setOpenAlexAuthor(null);
    setSelected(r);
    setModalTopic('');
    setReportText('');
    setMetricDetail(null);
  }, []);
  const openOpenAlexResearcher = useCallback(
    (authorIdOrUrl: string, summary?: OpenAlexAuthorSummary | null) => {
      setSelected(null);
      setOpenAlexAuthorId(authorIdOrUrl.trim());
      setOpenAlexAuthor(summary ?? null);
      setModalTopic('');
      setReportText('');
      setMetricDetail(null);
    },
    []
  );

  const resolveResearcherProfile = useCallback((profileId: string) => {
    const key = profileId.trim();
    setModalTopic('');
    setReportText('');
    setMetricDetail(null);
    setOpenAlexAuthor(null);

    if (isOpenAlexAuthorId(key)) {
      setSelected(null);
      setOpenAlexAuthorId(key.toUpperCase());
      return;
    }

    const local = findResearcherByProfileId(getData(), key);
    if (local) {
      setOpenAlexAuthorId(null);
      setSelected(local);
      return;
    }
    setSelected(null);
    setOpenAlexAuthorId(key);
  }, []);
  const closeResearcher = useCallback(() => {
    setSelected(null);
    setOpenAlexAuthorId(null);
    setOpenAlexAuthor(null);
    setModalTopic('');
    setReportText('');
    setMetricDetail(null);
  }, []);
  const goPerfiles = useCallback(() => { setTab('perfiles'); setPage(0); }, []);
  const goOrcid = useCallback(() => { setTab('perfiles'); setPage(0); }, []);

  const value: UIState = {
    tab, setTab, search, setSearch, searchType, setSearchType,
    page, setPage, resetPage,
    descubridorQuartile, setDescubridorQuartile,
    descubridorAccess, setDescubridorAccess,
    selected, openResearcher, openAlexAuthorId, openAlexAuthor, openOpenAlexResearcher, resolveResearcherProfile, closeResearcher,
    modalTopic, setModalTopic, viewCoAuthor, setViewCoAuthor,
    metricDetail, setMetricDetail, reportText, setReportText,
    reportLoading, setReportLoading,
    aiTab, setAiTab, chatMsgs, setChatMsgs,
    chatIn, setChatIn, chatLoading, setChatLoading,
    comp1, setComp1, comp2, setComp2, compQ, setCompQ,
    goPerfiles, goOrcid,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIState {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}