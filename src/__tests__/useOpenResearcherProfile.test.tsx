import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { UIProvider } from '../context/UIContext';
import { useOpenResearcherProfile } from '../app/hooks/useOpenResearcherProfile';
import { initData } from '../utils/dataProcessing';

const navigateMock = vi.fn();

vi.mock('../app/hooks/useTransitionNavigate', () => ({
  useTransitionNavigate: () => navigateMock,
}));

function wrapper({ children, initialEntries = ['/perfiles'] }: { children: ReactNode; initialEntries?: string[] }) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <UIProvider>{children}</UIProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  navigateMock.mockClear();
  initData({
    DATA: [{ id: '111', f: 'Ana', l: 'Silva', o: '0000-0001-1111-1111' }],
    OA: { authors: {}, institution: {} },
    AW: [],
    OD: { profiles: {} },
    AI: {},
    COAUTHORS: {},
    METRICS: {},
    RES_METRICS: {},
  });
});

describe('useOpenResearcherProfile', () => {
  it('opens local researcher synchronously and updates URL', () => {
    const { result } = renderHook(() => useOpenResearcherProfile(), { wrapper });
    const researcher = { id: '111', f: 'Ana', l: 'Silva', o: '0000-0001-1111-1111' };

    act(() => {
      result.current.openLocalResearcherProfile(researcher);
    });

    expect(navigateMock).toHaveBeenCalledWith('/perfiles/0000-0001-1111-1111');
  });

  it('does not change URL when opening profile from ODS detail', () => {
    const { result } = renderHook(() => useOpenResearcherProfile(), {
      wrapper: ({ children }) => wrapper({ children, initialEntries: ['/ods/12'] }),
    });
    const researcher = { id: '111', f: 'Ana', l: 'Silva', o: '0000-0001-1111-1111' };

    act(() => {
      result.current.openLocalResearcherProfile(researcher);
    });

    expect(navigateMock).not.toHaveBeenCalled();
  });
});
