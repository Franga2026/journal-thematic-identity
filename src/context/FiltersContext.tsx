import {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import { useUI } from './UIContext';
import { useDebounce } from '../app/hooks/useDebounce';
import { filterResearchers } from '../utils/dataProcessing';
import { PAGE_SIZE } from '../utils/constants';
import {
  fetchResearchers,
  mapApiItemToResearcher,
} from '../services/catalog/fetchResearchers';
import type { Researcher, RankKey } from '../shared/types';

interface FiltersState {
  dept: string;              setDept: (d: string) => void;
  onlyOrcid: boolean;        setOnlyOrcid: (o: boolean) => void;
  sdgFilter: string;         setSdgFilter: (s: string) => void;
  areaFilter: string;        setAreaFilter: (a: string) => void;
  rankBy: RankKey;            setRankBy: (r: RankKey) => void;
  workSearch: string;         setWorkSearch: (s: string) => void;
  workYear: string;           setWorkYear: (y: string) => void;
  workType: string;           setWorkType: (t: string) => void;
  workOA: boolean;            setWorkOA: (o: boolean) => void;
  workAccess: '' | 'open' | 'closed';
  setWorkAccess: (a: '' | 'open' | 'closed') => void;
  workTopic: string;          setWorkTopic: (t: string) => void;
  workField: string;          setWorkField: (f: string) => void;
  workSdg: string;            setWorkSdg: (s: string) => void;
  workPage: number;           setWorkPage: (p: number) => void;
  cSearch: string;            setCSearch: (s: string) => void;
  /** Página actual de investigadores (API o fallback local). */
  filtered: Researcher[];
  /** Total que cumple filtros (no solo la página). */
  filteredTotal: number;
  /** Con ORCID bajo los mismos filtros (para chip). */
  orcidTotal: number;
  totalPages: number;
  pageData: Researcher[];
  researchersLoading: boolean;
}

const FiltersContext = createContext<FiltersState | null>(null);

/** En tests Vitest: filtro local. En app: GET /researchers. */
const USE_RESEARCHERS_API = import.meta.env.MODE !== 'test';

export function FiltersProvider({ children }: { children: ReactNode }) {
  const { search, page, setPage } = useUI();
  // Esperar 300ms desde la última tecla antes de buscar en el API
  const debouncedQuery = useDebounce(search, 300);

  const [dept, setDept] = useState('');
  const [onlyOrcid, setOnlyOrcid] = useState(false);
  const [sdgFilter, setSdgFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [rankBy, setRankBy] = useState<RankKey>('fwci');
  const [workSearch, setWorkSearch] = useState('');
  const [workYear, setWorkYear] = useState('');
  const [workType, setWorkType] = useState('');
  const [workOA, setWorkOA] = useState(false);
  const [workAccess, setWorkAccess] = useState<'' | 'open' | 'closed'>('');
  const [workTopic, setWorkTopic] = useState('');
  const [workField, setWorkField] = useState('');
  const [workSdg, setWorkSdg] = useState('');
  const [workPage, setWorkPage] = useState(0);
  const [cSearch, setCSearch] = useState('');

  const [items, setItems] = useState<Researcher[]>([]);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [orcidTotal, setOrcidTotal] = useState(0);
  const [apiPages, setApiPages] = useState(1);
  const [researchersLoading, setResearchersLoading] = useState(false);
  const [useApi, setUseApi] = useState(USE_RESEARCHERS_API);

  // Fallback local (tests / API caída) — search en vivo (sin debounce)
  const localFiltered = useMemo(
    () =>
      filterResearchers({
        search,
        dept,
        onlyOrcid,
        sdgFilter,
        areaFilter,
      }) as Researcher[],
    [search, dept, onlyOrcid, sdgFilter, areaFilter]
  );

  useEffect(() => {
    if (!USE_RESEARCHERS_API || !useApi) return;

    const ac = new AbortController();
    const q = debouncedQuery.trim();
    const apiPage = page + 1; // UI 0-based → API 1-based

    setResearchersLoading(true);

    const base = {
      q: q.length >= 2 ? q : undefined,
      unit: dept || undefined,
      sdg: sdgFilter || undefined,
      field: areaFilter || undefined,
      page: apiPage,
      per_page: PAGE_SIZE,
      sort: 'name' as const,
    };

    Promise.all([
      fetchResearchers(
        { ...base, has_orcid: onlyOrcid ? true : undefined },
        ac.signal
      ),
      // Conteo ORCID con los mismos filtros (chip)
      onlyOrcid
        ? Promise.resolve(null)
        : fetchResearchers(
            { ...base, has_orcid: true, page: 1, per_page: 1 },
            ac.signal
          ),
    ])
      .then(([main, orcidHead]) => {
        if (ac.signal.aborted) return;
        if (!main) {
          setUseApi(false);
          return;
        }
        setItems(main.items.map(mapApiItemToResearcher));
        setFilteredTotal(main.total);
        setApiPages(Math.max(1, main.pages));
        if (onlyOrcid) {
          setOrcidTotal(main.total);
        } else if (orcidHead) {
          setOrcidTotal(orcidHead.total);
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setResearchersLoading(false);
      });

    return () => ac.abort();
  }, [debouncedQuery, dept, onlyOrcid, sdgFilter, areaFilter, page, useApi]);

  const filtered = useApi ? items : localFiltered;
  const totalPages = useApi
    ? apiPages
    : Math.max(1, Math.ceil(localFiltered.length / PAGE_SIZE));
  const pageData = useApi
    ? items
    : localFiltered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const total = useApi ? filteredTotal : localFiltered.length;
  const orcidCount = useApi
    ? orcidTotal
    : localFiltered.filter((r) => r.o).length;

  useEffect(() => {
    if (page > totalPages - 1) setPage(0);
  }, [page, totalPages, setPage]);

  const value: FiltersState = {
    dept, setDept, onlyOrcid, setOnlyOrcid,
    sdgFilter, setSdgFilter, areaFilter, setAreaFilter,
    rankBy, setRankBy,
    workSearch, setWorkSearch, workYear, setWorkYear,
    workType, setWorkType, workOA, setWorkOA,
    workAccess, setWorkAccess, workTopic, setWorkTopic,
    workField, setWorkField, workSdg, setWorkSdg,
    workPage, setWorkPage, cSearch, setCSearch,
    filtered,
    filteredTotal: total,
    orcidTotal: orcidCount,
    totalPages,
    pageData,
    researchersLoading,
  };

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersState {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider');
  return ctx;
}
