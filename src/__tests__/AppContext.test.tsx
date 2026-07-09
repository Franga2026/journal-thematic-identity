import { describe, it, expect, beforeAll } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProvider, useApp } from '../context/AppContext';
import { initData } from '../utils/dataProcessing';

const MOCK_DATA = [
  { f: 'Juan', l: 'Pérez', o: '0000-0001-0000-0001', dp: [{ d: 'Física' }], t: 'Profesor', e: 'jp@uta.cl' },
  { f: 'María', l: 'González', o: '0000-0002-0000-0002', dp: [{ d: 'Química' }], t: 'Investigadora' },
  { f: 'Carlos', l: 'López', dp: [{ d: 'Física' }], t: 'Académico' },
  { f: 'Ana', l: 'Martínez', o: '0000-0003-0000-0003', dp: [{ d: 'Biología' }] },
];

beforeAll(() => {
  initData({
    DATA: MOCK_DATA,
    OA: { institution: { works_count: 100, cited_by_count: 500, h_index: 10, sdgs: [] }, authors: {}, sdg_researchers: {} },
    AW: [], OD: { profiles: {} }, AI: {}, COAUTHORS: {}, METRICS: { researcher_distributions: {} }, RES_METRICS: {},
  });
});

function useAppHook() {
  return renderHook(() => useApp(), { wrapper: AppProvider });
}

describe('AppContext', () => {
  it('provides default state', () => {
    const { result } = useAppHook();
    expect(result.current.tab).toBe('perfiles');
    expect(result.current.search).toBe('');
    expect(result.current.selected).toBeNull();
  });

  it('filters researchers by name', () => {
    const { result } = useAppHook();
    expect(result.current.filtered.length).toBe(4);

    act(() => result.current.setSearch('Juan'));
    expect(result.current.filtered.length).toBe(1);
    expect(result.current.filtered[0].f).toBe('Juan');
  });

  it('filters researchers by department', () => {
    const { result } = useAppHook();
    act(() => result.current.setDept('Física'));
    expect(result.current.filtered.length).toBe(2);
  });

  it('filters ORCID-only researchers', () => {
    const { result } = useAppHook();
    act(() => result.current.setOnlyOrcid(true));
    expect(result.current.filtered.length).toBe(3);
    expect(result.current.filtered.every((r) => r.o)).toBe(true);
  });

  it('paginates correctly', () => {
    const { result } = useAppHook();
    expect(result.current.page).toBe(0);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageData.length).toBe(4);
  });

  it('resets page on filter change', () => {
    const { result } = useAppHook();
    act(() => result.current.setPage(5));
    act(() => result.current.setSearch('María'));
    // Page should auto-correct to 0 since there's only 1 result
    expect(result.current.page).toBeLessThanOrEqual(result.current.totalPages - 1);
  });

  it('navigates tabs', () => {
    const { result } = useAppHook();
    act(() => result.current.setTab('ranking'));
    expect(result.current.tab).toBe('ranking');
  });

  it('opens and closes researcher modal', () => {
    const { result } = useAppHook();
    const researcher = MOCK_DATA[0];

    act(() => result.current.openResearcher(researcher));
    expect(result.current.selected).toBe(researcher);

    act(() => result.current.closeResearcher());
    expect(result.current.selected).toBeNull();
  });

  it('returns to previous OpenAlex profile when closing nested coauthor modal', () => {
    const { result } = useAppHook();
    const authorA = {
      id: 'A111',
      openAlexId: 'A111',
      display_name: 'Autor A',
      cited_by_count: 10,
      works_count: 5,
    };
    const authorB = {
      id: 'A222',
      openAlexId: 'A222',
      display_name: 'Autor B',
      cited_by_count: 20,
      works_count: 8,
    };

    act(() => result.current.openOpenAlexResearcher('A111', authorA));
    expect(result.current.openAlexAuthorId).toBe('A111');

    act(() => result.current.openOpenAlexResearcherKeepingPrevious('A222', authorB));
    expect(result.current.openAlexAuthorId).toBe('A222');
    expect(result.current.openAlexAuthor?.display_name).toBe('Autor B');

    act(() => result.current.closeResearcher());
    expect(result.current.openAlexAuthorId).toBe('A111');
    expect(result.current.openAlexAuthor?.display_name).toBe('Autor A');

    act(() => result.current.closeResearcher());
    expect(result.current.openAlexAuthorId).toBeNull();
  });

  it('goPerfiles navigates to perfiles tab and resets page', () => {
    const { result } = useAppHook();
    act(() => {
      result.current.setTab('ranking');
      result.current.setPage(2);
    });

    act(() => result.current.goPerfiles());
    expect(result.current.tab).toBe('perfiles');
    expect(result.current.page).toBe(0);
  });
});
