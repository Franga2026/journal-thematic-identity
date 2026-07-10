import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode, type Dispatch, type SetStateAction } from 'react';
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
  /** Abre ficha UTA apilando la actual; closeResearcher hace pop (cadena A→B→C…). */
  openResearcherKeepingPrevious: (r: Researcher) => void;
  /** ORCID, RUT o OpenAlex A-id para ficha externa (fetch en ResearcherModal) */
  openAlexAuthorId: string | null;
  /** Datos completos del autor externo (de la fila del ranking), para pintar la ficha sin red */
  openAlexAuthor: OpenAlexAuthorSummary | null;
  openOpenAlexResearcher: (authorIdOrUrl: string, summary?: OpenAlexAuthorSummary | null) => void;
  /** Abre ficha OpenAlex recordando la actual para volver con closeResearcher (un nivel). */
  openOpenAlexResearcherKeepingPrevious: (authorIdOrUrl: string, summary?: OpenAlexAuthorSummary | null) => void;
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
  modalStack: ModalEntry[];
  pushModal: (entry: ModalEntry) => void;
  popModal: () => void;
  resetModalStack: (entry: ModalEntry | null) => void;
  closeAllModals: () => void;
  topModal: ModalEntry | null;
}

const UIContext = createContext<UIState | null>(null);

interface OpenAlexNavEntry {
  authorId: string;
  summary: OpenAlexAuthorSummary | null;
}

export type ModalEntry =
  | { kind: 'uta'; researcher: Researcher; topic?: string | null }
  | { kind: 'openalex'; authorId: string; summary: OpenAlexAuthorSummary | null }
  | { kind: 'coauthor'; profile: CoAuthorProfile };

export function UIProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<TabKey>('perfiles');
  const [search, setSearch] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('texto');
  const [page, setPage] = useState(0);
  const [descubridorQuartile, setDescubridorQuartile] = useState('');
  const [descubridorAccess, setDescubridorAccess] = useState<'' | 'open' | 'closed'>('');

  const [selected, setSelected] = useState<Researcher | null>(null);
  const [researcherStack, setResearcherStack] = useState<Researcher[]>([]);
  const [openAlexAuthorId, setOpenAlexAuthorId] = useState<string | null>(null);
  const [openAlexAuthor, setOpenAlexAuthor] = useState<OpenAlexAuthorSummary | null>(null);
  const [openAlexNavStack, setOpenAlexNavStack] = useState<OpenAlexNavEntry[]>([]);
  const [modalStack, setModalStack] = useState<ModalEntry[]>([]);
  const openAlexAuthorIdRef = useRef(openAlexAuthorId);
  const openAlexAuthorRef = useRef(openAlexAuthor);

  useEffect(() => {
    openAlexAuthorIdRef.current = openAlexAuthorId;
  }, [openAlexAuthorId]);

  useEffect(() => {
    openAlexAuthorRef.current = openAlexAuthor;
  }, [openAlexAuthor]);
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
    setResearcherStack([]);
    setOpenAlexNavStack([]);
    setOpenAlexAuthorId(null);
    setOpenAlexAuthor(null);
    setSelected(r);
    setModalTopic('');
    setReportText('');
    setMetricDetail(null);
  }, []);
  const openResearcherKeepingPrevious = useCallback((next: Researcher) => {
    setSelected((current) => {
      if (current) setResearcherStack((s) => [...s, current]);
      return next;
    });
    setOpenAlexNavStack([]);
    setOpenAlexAuthorId(null);
    setOpenAlexAuthor(null);
    setModalTopic('');
    setReportText('');
    setMetricDetail(null);
  }, []);
  const openOpenAlexResearcher = useCallback(
    (authorIdOrUrl: string, summary?: OpenAlexAuthorSummary | null) => {
      setOpenAlexNavStack([]);
      setSelected(null);
      setOpenAlexAuthorId(authorIdOrUrl.trim());
      setOpenAlexAuthor(summary ?? null);
      setModalTopic('');
      setReportText('');
      setMetricDetail(null);
    },
    [],
  );

  const openOpenAlexResearcherKeepingPrevious = useCallback(
    (authorIdOrUrl: string, summary?: OpenAlexAuthorSummary | null) => {
      const currentId = openAlexAuthorIdRef.current;
      const currentSummary = openAlexAuthorRef.current;
      if (currentId) {
        setOpenAlexNavStack((prev) => [...prev, { authorId: currentId, summary: currentSummary }]);
      }
      setSelected(null);
      setOpenAlexAuthorId(authorIdOrUrl.trim());
      setOpenAlexAuthor(summary ?? null);
      setModalTopic('');
      setReportText('');
      setMetricDetail(null);
    },
    [],
  );

  const resolveResearcherProfile = useCallback((profileId: string) => {
    const key = profileId.trim();
    setModalTopic('');
    setReportText('');
    setMetricDetail(null);
    setOpenAlexAuthor(null);
    setOpenAlexNavStack([]);

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
    if (openAlexNavStack.length > 0) {
      const prev = openAlexNavStack[openAlexNavStack.length - 1];
      setOpenAlexNavStack((stack) => stack.slice(0, -1));
      setSelected(null);
      setOpenAlexAuthorId(prev.authorId);
      setOpenAlexAuthor(prev.summary);
      setModalTopic('');
      setReportText('');
      setMetricDetail(null);
      return;
    }
    if (researcherStack.length > 0) {
      const prev = researcherStack[researcherStack.length - 1];
      setResearcherStack((stack) => stack.slice(0, -1));
      setSelected(prev);
      setOpenAlexAuthorId(null);
      setOpenAlexAuthor(null);
      setModalTopic('');
      setReportText('');
      setMetricDetail(null);
      return;
    }
    setSelected(null);
    setOpenAlexAuthorId(null);
    setOpenAlexAuthor(null);
    setModalTopic('');
    setReportText('');
    setMetricDetail(null);
  }, [openAlexNavStack, researcherStack]);
  const pushModal = useCallback((entry: ModalEntry) => {
    setModalStack((s) => [...s, entry]);
  }, []);
  const popModal = useCallback(() => {
    setModalStack((s) => s.slice(0, -1));
  }, []);
  const resetModalStack = useCallback((entry: ModalEntry | null) => {
    setModalStack(entry ? [entry] : []);
  }, []);
  const closeAllModals = useCallback(() => {
    setModalStack([]);
  }, []);
  const topModal: ModalEntry | null =
    modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;
  const goPerfiles = useCallback(() => { setTab('perfiles'); setPage(0); }, []);
  const goOrcid = useCallback(() => { setTab('perfiles'); setPage(0); }, []);

  const value: UIState = {
    tab, setTab, search, setSearch, searchType, setSearchType,
    page, setPage, resetPage,
    descubridorQuartile, setDescubridorQuartile,
    descubridorAccess, setDescubridorAccess,
    selected, openResearcher, openResearcherKeepingPrevious, openAlexAuthorId, openAlexAuthor, openOpenAlexResearcher, openOpenAlexResearcherKeepingPrevious, resolveResearcherProfile, closeResearcher,
    modalTopic, setModalTopic, viewCoAuthor, setViewCoAuthor,
    metricDetail, setMetricDetail, reportText, setReportText,
    reportLoading, setReportLoading,
    aiTab, setAiTab, chatMsgs, setChatMsgs,
    chatIn, setChatIn, chatLoading, setChatLoading,
    comp1, setComp1, comp2, setComp2, compQ, setCompQ,
    goPerfiles, goOrcid,
    modalStack, pushModal, popModal, resetModalStack, closeAllModals, topModal,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIState {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}