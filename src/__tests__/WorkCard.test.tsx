import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkCard from '../components/cards/WorkCard';
import type { Work } from '../shared/types';

const FULL_WORK: Work = {
  t: 'Quantum Effects in Nanostructures',
  y: 2023,
  c: 42,
  s: 'Nature Physics',
  tp: 'article',
  oa: true,
  ou: 'https://example.com/open',
  d: '10.1234/test',
  field: 'Physics',
  qi: 'Q1',
  qc: '#dc2626',
  impact: 2.5,
  a: ['A. Silva', 'B. Jones', 'C. Smith', 'D. Lee', 'E. Wang'],
};

const MINIMAL_WORK: Work = {
  t: 'Simple Title',
  y: 2020,
  c: 0,
};

describe('WorkCard', () => {
  it('renders title and year', () => {
    render(<WorkCard w={FULL_WORK} />);
    expect(screen.getByText('Quantum Effects in Nanostructures')).toBeDefined();
    expect(screen.getByText('2023')).toBeDefined();
  });

  it('renders journal source', () => {
    render(<WorkCard w={FULL_WORK} />);
    expect(screen.getByText('Nature Physics')).toBeDefined();
  });

  it('shows citation count', () => {
    render(<WorkCard w={FULL_WORK} />);
    expect(screen.getByText('42 citas')).toBeDefined();
  });

  it('shows OA badge when open access', () => {
    render(<WorkCard w={FULL_WORK} />);
    expect(screen.getByText('OA')).toBeDefined();
  });

  it('does not show OA badge for closed work', () => {
    render(<WorkCard w={MINIMAL_WORK} />);
    expect(screen.queryByText('OA')).toBeNull();
  });

  it('shows quartile badge', () => {
    render(<WorkCard w={FULL_WORK} />);
    expect(screen.getByText('Q1')).toBeDefined();
  });

  it('shows impact factor', () => {
    render(<WorkCard w={FULL_WORK} />);
    expect(screen.getByText('⚡2.5')).toBeDefined();
  });

  it('shows field badge', () => {
    render(<WorkCard w={FULL_WORK} />);
    expect(screen.getByText('Physics')).toBeDefined();
  });

  it('truncates author list in compact mode', () => {
    render(<WorkCard w={FULL_WORK} compact />);
    // compact mode shows max 3 authors + "+2 más"
    expect(screen.getByText(/\+2 más/)).toBeDefined();
  });

  it('shows "Leer" button for OA works', () => {
    render(<WorkCard w={FULL_WORK} />);
    expect(screen.getByText('📖 Leer')).toBeDefined();
  });

  it('shows "Acceder" button for closed works', () => {
    const closed: Work = { ...FULL_WORK, oa: false, ou: '', d: '10.1234/test' };
    render(<WorkCard w={closed} />);
    expect(screen.getByText('🔗 Acceder')).toBeDefined();
  });

  it('handles null work gracefully', () => {
    const { container } = render(<WorkCard w={null as any} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows disabled Acceder when no URL at all', () => {
    render(<WorkCard w={{ c: 5 } as Work} />);
    const btn = screen.getByRole('button', { name: /Acceder/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByText('Sin título')).toBeDefined();
  });

  it('strips HTML from title', () => {
    const w: Work = { t: 'Test <b>bold</b> title', y: 2023, c: 0 };
    render(<WorkCard w={w} />);
    expect(screen.getByText('Test bold title')).toBeDefined();
  });
});
