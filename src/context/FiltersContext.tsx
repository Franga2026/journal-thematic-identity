import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from 'react';
import { useUI } from './UIContext';
import { filterResearchers } from '../utils/dataProcessing';
import { PAGE_SIZE } from '../utils/constants';
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
  workField: string;          setWorkField: (f: string) => void;
  workSdg: string;            setWorkSdg: (s: string) => void;
  workPage: number;           setWorkPage: (p: number) => void;
  cSearch: string;            setCSearch: (s: string) => void;
  filtered: Researcher[];
  totalPages: number;
  pageData: Researcher[];
}

const FiltersContext = createContext<FiltersState | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const { search, page, setPage } = useUI();

  const [dept, setDept] = useState('');
  const [onlyOrcid, setOnlyOrcid] = useState(false);
  const [sdgFilter, setSdgFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [rankBy, setRankBy] = useState<RankKey>('fwci');
  const [workSearch, setWorkSearch] = useState('');
  const [workYear, setWorkYear] = useState('');
  const [workType, setWorkType] = useState('');
  const [workOA, setWorkOA] = useState(false);
  const [workField, setWorkField] = useState('');
  const [workSdg, setWorkSdg] = useState('');
  const [workPage, setWorkPage] = useState(0);
  const [cSearch, setCSearch] = useState('');

  const filtered = useMemo(
    () => filterResearchers({ search, dept, onlyOrcid, sdgFilter, areaFilter }) as Researcher[],
    [search, dept, onlyOrcid, sdgFilter, areaFilter]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages - 1) setPage(0);
  }, [page, totalPages, setPage]);

  const value: FiltersState = {
    dept, setDept, onlyOrcid, setOnlyOrcid,
    sdgFilter, setSdgFilter, areaFilter, setAreaFilter,
    rankBy, setRankBy,
    workSearch, setWorkSearch, workYear, setWorkYear,
    workType, setWorkType, workOA, setWorkOA,
    workField, setWorkField, workSdg, setWorkSdg,
    workPage, setWorkPage, cSearch, setCSearch,
    filtered, totalPages, pageData,
  };

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersState {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider');
  return ctx;
}
