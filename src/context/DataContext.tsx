import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  getData,
  getInstitution,
  getDepartments,
  getDeptCounts,
  getDeptOrcidCoverage,
} from '../utils/dataProcessing';
import type { Researcher, InstitutionOA, DeptOrcidCoverage } from '../shared/types';

export type { DeptOrcidCoverage };

interface DataState {
  DATA: Researcher[];
  INST: InstitutionOA;
  DEPTS: string[];
  deptCounts: Record<string, number>;
  deptOrcid: Record<string, DeptOrcidCoverage>;
}

const DataContext = createContext<DataState | null>(null);

/**
 * Lee el store ya hidratado por bootstrapData → initData.
 * Unidades vienen de GET /units si el API respondió; si no, del JSON.
 * TabUnidades / useApp() no cambian.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const DATA = getData() as Researcher[];
  const INST = getInstitution() as InstitutionOA;
  const DEPTS = useMemo(() => getDepartments() as string[], []);
  const deptCounts = useMemo(() => getDeptCounts() as Record<string, number>, []);
  const deptOrcid = useMemo(
    () => getDeptOrcidCoverage() as Record<string, DeptOrcidCoverage>,
    []
  );

  const value = useMemo<DataState>(
    () => ({ DATA, INST, DEPTS, deptCounts, deptOrcid }),
    [DATA, INST, DEPTS, deptCounts, deptOrcid]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
