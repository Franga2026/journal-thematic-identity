import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getData, getInstitution, getDepartments, getDeptCounts } from '../utils/dataProcessing';
import type { Researcher, InstitutionOA } from '../shared/types';

interface DataState {
  DATA: Researcher[];
  INST: InstitutionOA;
  DEPTS: string[];
  deptCounts: Record<string, number>;
}

const DataContext = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const DATA = getData() as Researcher[];
  const INST = getInstitution() as InstitutionOA;
  const DEPTS = useMemo(() => getDepartments(), []);
  const deptCounts = useMemo(() => getDeptCounts() as Record<string, number>, []);

  const value = useMemo<DataState>(
    () => ({ DATA, INST, DEPTS, deptCounts }),
    [DATA, INST, DEPTS, deptCounts]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
