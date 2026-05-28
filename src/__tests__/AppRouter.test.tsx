import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { initData } from '../utils/dataProcessing';

beforeAll(() => {
  initData({
    DATA: [
      { f: 'Test', l: 'User', o: '0000-0001', dp: [{ d: 'Test Dept' }] },
    ],
    OA: {
      institution: { works_count: 10, cited_by_count: 50, h_index: 3, sdgs: [] },
      authors: {},
      sdg_researchers: {},
    },
    AW: [],
    OD: { profiles: {} },
    AI: {},
    COAUTHORS: {},
    METRICS: { researcher_distributions: {} },
    RES_METRICS: {},
  });
});

describe('AppRouter (via App)', () => {
  it('renders default route /perfiles via Suspense', async () => {
    render(<App />);

    await waitFor(
      () => {
        expect(screen.getByRole('heading', { level: 2, name: /perfiles/i })).toBeDefined();
      },
      { timeout: 5000 }
    );
  });

  it('renders without critical error boundary message', () => {
    const { container } = render(<App />);
    expect(container.innerHTML).not.toContain('Error crítico');
  });

  it('has tab navigation wired to the router', () => {
    render(<App />);
    expect(screen.getByRole('tablist', { name: /secciones del directorio/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Perfiles' })).toBeDefined();
  });

  it('does not render modals when no researcher is selected', () => {
    render(<App />);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('suppresses lazy-load noise when ErrorBoundary is present', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<App />);
    expect(screen.getByRole('banner')).toBeDefined();
    spy.mockRestore();
  });
});
