import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getData, getInstitution, getDepartments, getDeptCounts, getOrcidCount } from '../utils/dataProcessing';
import type { Researcher, InstitutionOA } from '../shared/types';

interface DataState {
  DATA: Researcher[];
  INST: InstitutionOA;
  DEPTS: string[];
  deptCounts: Record<string, number>;
  ORCID_COUNT: number;
}

const DataContext = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const DATA = getData() as Researcher[];
  const INST = getInstitution() as InstitutionOA;
  const DEPTS = useMemo(() => getDepartments(), []);
  const deptCounts = useMemo(() => getDeptCounts() as Record<string, number>, []);
  const ORCID_COUNT = useMemo(() => getOrcidCount(), []);

  const value = useMemo<DataState>(
    () => ({ DATA, INST, DEPTS, deptCounts, ORCID_COUNT }),
    [DATA, INST, DEPTS, deptCounts, ORCID_COUNT]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
