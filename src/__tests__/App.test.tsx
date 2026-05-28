import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import { initData } from '../utils/dataProcessing';

// ─── Mock data for tests ───
const MOCK_DATA = [
  { f: 'Juan', l: 'Pérez', t: 'Profesor', o: '0000-0001-0000-0001', dp: [{ d: 'Departamento de Física' }], e: 'jperez@uta.cl' },
  { f: 'María', l: 'González', t: 'Investigadora', o: '0000-0002-0000-0002', dp: [{ d: 'Departamento de Química' }] },
  { f: 'Carlos', l: 'López', t: 'Académico', dp: [{ d: 'Departamento de Física' }] },
];

const MOCK_OA = {
  institution: { works_count: 500, cited_by_count: 3000, h_index: 25, sdgs: [] },
  authors: {
    '0000-0001-0000-0001': { works_count: 20, cited_by_count: 150, h_index: 8, works: [] },
    '0000-0002-0000-0002': { works_count: 15, cited_by_count: 80, h_index: 5, works: [] },
  },
  sdg_researchers: {},
};

beforeAll(() => {
  initData({
    DATA: MOCK_DATA,
    OA: MOCK_OA,
    AW: [],
    OD: { profiles: {} },
    AI: { summaries: {}, affinity: {}, gaps: {} },
    COAUTHORS: {},
    METRICS: { researcher_distributions: {} },
    RES_METRICS: {},
  });
});

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toBeDefined();
  });

  it('displays the university title', () => {
    render(<App />);
    expect(screen.getByRole('banner').textContent).toMatch(/Universidad de Tarapacá/);
  });

  it('renders the search input', () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/buscar por nombre/i)).toBeDefined();
  });

  it('renders tab navigation', () => {
    render(<App />);
    expect(screen.getByRole('tablist', { name: /secciones/i })).toBeDefined();
  });

  it('renders footer', () => {
    render(<App />);
    expect(screen.getByRole('contentinfo')).toBeDefined();
  });
});
