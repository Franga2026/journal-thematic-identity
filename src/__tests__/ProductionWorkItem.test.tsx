import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductionWorkItem from '../components/production/ProductionWorkItem';
import type { Work } from '../shared/types';

const WORK: Work = {
  t: 'Sample <i>paper</i>',
  y: 2022,
  c: 34,
  s: 'Revista X',
  tp: 'article',
  oa: true,
  ou: 'https://example.org/paper.pdf',
  a: ['Juan Pérez', 'María Soto', 'Luis Rojas', 'Ana Díaz'],
  field: 'Physics',
};

describe('ProductionWorkItem', () => {
  it('renders title, meta line, and badges', () => {
    render(<ProductionWorkItem work={WORK} />);
    expect(screen.getByRole('link', { name: /Sample paper/i })).toBeTruthy();
    expect(screen.getByText(/2022/)).toBeTruthy();
    expect(screen.getByText(/Juan Pérez/)).toBeTruthy();
    expect(screen.getByText(/Revista X/)).toBeTruthy();
    expect(screen.getByText(/34 citas/)).toBeTruthy();
    expect(screen.getByText('Open Access')).toBeTruthy();
    expect(screen.getByText('PDF')).toBeTruthy();
  });

  it('handles missing fields', () => {
    render(<ProductionWorkItem work={{ c: 0 } as Work} />);
    expect(screen.getByText('Sin título')).toBeTruthy();
    expect(screen.getByText(/0 citas/)).toBeTruthy();
  });

  it('opens citation panel when Citar is clicked', () => {
    render(<ProductionWorkItem work={WORK} />);
    fireEvent.click(screen.getByRole('button', { name: /Citar/i }));
    expect(screen.getByRole('dialog', { name: 'Citas bibliográficas' })).toBeTruthy();
    expect(screen.getByText(/APA 7/)).toBeTruthy();
  });
});
