import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkRow from '../components/cards/WorkRow';
import type { Work } from '../shared/types';

const SAMPLE_WORK: Work = {
  t: 'Quantum Effects in Nanostructures',
  y: 2023,
  c: 42,
  s: 'Nature Physics',
  oa: true,
  d: '10.1234/test',
  field: 'Physics',
  topic: 'Nanotechnology',
  qi: 'Q1',
  impact: 2.5,
  a: ['A. Silva', 'B. Jones', 'C. Smith', 'D. Lee'],
};

function renderRow(
  w: Work = SAMPLE_WORK,
  opts: { expanded?: boolean; onToggle?: (id: string) => void } = {},
) {
  const onToggle = opts.onToggle ?? vi.fn();
  const result = render(
    <WorkRow
      w={w}
      variant="production"
      rowId="row-0"
      expanded={opts.expanded ?? false}
      onToggle={onToggle}
    />,
  );
  return { ...result, onToggle };
}

describe('WorkRow', () => {
  it('renders title, year, metrics and quartile badge', () => {
    renderRow();
    expect(screen.getByText('Quantum Effects in Nanostructures')).toBeDefined();
    expect(screen.getByText('2023')).toBeDefined();
    expect(screen.getByText('2,5×')).toBeDefined();
    expect(screen.getByText('Q1')).toBeDefined();
  });

  it('normalizes bare quartile digits to Q-prefix', () => {
    renderRow({ ...SAMPLE_WORK, qi: '4' });
    expect(screen.getByText('Q4')).toBeDefined();
  });

  it('shows gray dash quartile when qi is missing', () => {
    renderRow({ ...SAMPLE_WORK, qi: undefined }, { expanded: false });
    expect(screen.getByText('—')).toBeDefined();
  });

  it('calls onToggle when row is clicked', () => {
    const { container, onToggle } = renderRow();
    const row = container.querySelector('.work-row');
    expect(row).toBeTruthy();
    fireEvent.click(row!);
    expect(onToggle).toHaveBeenCalledWith('row-0');
  });

  it('expands detail with authors and DOI when expanded', () => {
    renderRow(SAMPLE_WORK, { expanded: true });
    expect(screen.getByText(/Autores:/)).toBeDefined();
    expect(screen.getByText(/DOI:/)).toBeDefined();
    expect(screen.getByText('Citar')).toBeDefined();
    expect(screen.getByText('Resumen IA')).toBeDefined();
    expect(screen.getByText('Acceder')).toBeDefined();
  });
});
