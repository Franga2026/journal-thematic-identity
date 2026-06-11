import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkCard from '../components/cards/WorkCard';
import { UIProvider } from '../context/UIContext';
import type { Researcher, Work } from '../shared/types';
import { CURRENT_YEAR } from '../shared/metrics/fwci';
import { utaLink } from './utaLinkFixtures';

const MOCK_RESEARCHER: Researcher = { f: 'Ana', l: 'Silva', id: 'uta-1', o: '0000-0001-1111-1111' };
const MOCK_RESEARCHER_2: Researcher = { f: 'Bob', l: 'UTA', id: 'uta-2', o: '0000-0002-2222-2222' };

function linkedWork(overrides: Partial<Work> = {}): Work {
  return {
    ...FULL_WORK,
    a: ['Ana Silva', 'Bob UTA'],
    authorships: [
      { author: { display_name: 'Ana Silva', orcid: 'https://orcid.org/0000-0001-1111-1111' } },
      { author: { display_name: 'Bob UTA', orcid: 'https://orcid.org/0000-0002-2222-2222' } },
    ],
    autores_uta: [
      utaLink('uta-1', '0000-0001-1111-1111', 'Ana Silva', 0),
      utaLink('uta-2', '0000-0002-2222-2222', 'Bob UTA', 1),
    ],
    ...overrides,
  };
}

vi.mock('../utils/dataProcessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/dataProcessing')>();
  return {
    ...actual,
    getData: () => [MOCK_RESEARCHER, MOCK_RESEARCHER_2],
  };
});

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
  pub: 'Nature Publishing Group',
  a: ['A. Silva', 'B. Jones', 'C. Smith', 'D. Lee', 'E. Wang'],
  sdgs: ['Climate action'],
};

const MINIMAL_WORK: Work = {
  t: 'Simple Title',
  y: 2020,
  c: 0,
};

function renderCard(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <UIProvider>{ui}</UIProvider>
    </MemoryRouter>,
  );
}

describe('WorkCard', () => {
  it('renders title and year in discovery variant', () => {
    renderCard(<WorkCard w={FULL_WORK} variant="discovery" />);
    expect(screen.getByText('Quantum Effects in Nanostructures')).toBeDefined();
    expect(screen.getByText(/2023/)).toBeDefined();
  });

  it('renders production variant without error', () => {
    const work: Work = { ...FULL_WORK, topic: 'Nanotechnology', field: 'Physics' };
    renderCard(<WorkCard w={work} variant="production" />);
    expect(screen.getByText('Quantum Effects in Nanostructures')).toBeDefined();
    expect(screen.getByText(/Nanotechnology/)).toBeDefined();
  });

  it('shows citation count in metric tile', () => {
    renderCard(<WorkCard w={FULL_WORK} variant="discovery" />);
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('citas en OpenAlex')).toBeDefined();
  });

  it('shows FWCI value when impact is present', () => {
    renderCard(<WorkCard w={FULL_WORK} variant="discovery" />);
    expect(screen.getByText('2.50')).toBeDefined();
    expect(screen.getByText('2.50× la media del campo')).toBeDefined();
  });

  it('shows em dash for FWCI when impact is missing', () => {
    renderCard(<WorkCard w={MINIMAL_WORK} variant="discovery" />);
    expect(screen.getByText('—')).toBeDefined();
    expect(screen.queryByText(/× la media del campo/)).toBeNull();
  });

  it('shows em dash for FWCI on current-year work and keeps citations', () => {
    const currentYear = new Date().getFullYear();
    const work: Work = {
      t: 'Fresh paper',
      y: currentYear,
      c: 0,
      cited_by_count: 0,
      impact: 0,
      fwci: 0,
      openalex_id: 'W7162097201',
    };
    renderCard(<WorkCard w={work} variant="production" />);
    expect(screen.getByText('—')).toBeDefined();
    expect(screen.queryByText(/× la media del campo/)).toBeNull();
    expect(screen.getByText('0')).toBeDefined();
    expect(screen.getByText('citas en OpenAlex')).toBeDefined();
    expect(screen.queryByText('0.00× la media del campo')).toBeNull();
  });

  it('shows quartile chip', () => {
    renderCard(<WorkCard w={FULL_WORK} variant="discovery" />);
    expect(screen.getByText('SJR · Q1')).toBeDefined();
  });

  it('shows field chip', () => {
    renderCard(<WorkCard w={FULL_WORK} variant="discovery" />);
    expect(screen.getAllByText('Physics').length).toBeGreaterThan(0);
  });

  it('truncates author list in compact variant', () => {
    renderCard(<WorkCard w={FULL_WORK} variant="compact" />);
    expect(screen.getByText(/\+2/)).toBeDefined();
  });

  it('shows Acceder button', () => {
    renderCard(<WorkCard w={FULL_WORK} variant="discovery" />);
    expect(screen.getByRole('button', { name: 'Acceder' })).toBeDefined();
  });

  it('shows disabled Acceder when no URL at all', () => {
    renderCard(<WorkCard w={{ c: 5 } as Work} variant="discovery" />);
    const btn = screen.getByRole('button', { name: 'Acceder' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByText('Sin título')).toBeDefined();
  });

  it('strips HTML from title', () => {
    const w: Work = { t: 'Test <b>bold</b> title', y: 2023, c: 0 };
    renderCard(<WorkCard w={w} variant="discovery" />);
    expect(screen.getByText('Test bold title')).toBeDefined();
  });

  it('handles null work gracefully', () => {
    const { container } = renderCard(<WorkCard w={null as unknown as Work} variant="discovery" />);
    expect(container.innerHTML).toBe('');
  });

  it('shows open access chip when oa is true', () => {
    renderCard(<WorkCard w={FULL_WORK} variant="discovery" />);
    expect(screen.getByText('Acceso abierto')).toBeDefined();
  });

  it('hides access chip when work is not OA', () => {
    renderCard(<WorkCard w={MINIMAL_WORK} variant="discovery" />);
    expect(screen.queryByText('Acceso por suscripción')).toBeNull();
    expect(screen.queryByText('Acceso abierto')).toBeNull();
  });

  it('hides Ver ficha for the open profile researcher in production variant', () => {
    const work = linkedWork({ a: ['Ana Silva', 'B. Jones'] });
    renderCard(
      <WorkCard
        w={work}
        variant="production"
        currentResearcher={MOCK_RESEARCHER}
        onOpenResearcher={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Ver ficha/i })).toBeNull();
    expect(screen.getByText('Ana Silva')).toBeDefined();
  });

  it('shows Ver ficha for other UTA coauthors when currentResearcher is set', () => {
    const work = linkedWork();
    const onOpenResearcher = vi.fn();
    renderCard(
      <WorkCard
        w={work}
        variant="production"
        currentResearcher={MOCK_RESEARCHER}
        onOpenResearcher={onOpenResearcher}
      />,
    );
    const btn = screen.getByRole('button', { name: /Ver ficha/i });
    fireEvent.click(btn);
    expect(onOpenResearcher).toHaveBeenCalledWith('uta-2');
  });

  it('shows Ver ficha and calls onOpenResearcher for UTA author in production variant', () => {
    const work = linkedWork({ a: ['Ana Silva', 'B. Jones'] });
    const onOpenResearcher = vi.fn();
    renderCard(
      <WorkCard w={work} variant="production" onOpenResearcher={onOpenResearcher} />,
    );
    const btn = screen.getByRole('button', { name: /Ver ficha/i });
    fireEvent.click(btn);
    expect(onOpenResearcher).toHaveBeenCalledWith('uta-1');
  });

  it('shows Ver ficha and calls onOpenResearcher for UTA author in discovery variant', () => {
    const work = linkedWork({ a: ['Ana Silva', 'B. Jones'] });
    const onOpenResearcher = vi.fn();
    renderCard(
      <WorkCard w={work} variant="discovery" onOpenResearcher={onOpenResearcher} />,
    );
    const btn = screen.getByRole('button', { name: /Ver ficha/i });
    fireEvent.click(btn);
    expect(onOpenResearcher).toHaveBeenCalledWith('uta-1');
  });

  it('renders DOI link when d is present', () => {
    renderCard(<WorkCard w={FULL_WORK} variant="discovery" />);
    const link = screen.getByRole('link', { name: 'DOI ↗' });
    expect(link.getAttribute('href')).toContain('doi.org');
  });

  it('links metric external icons to OpenAlex in production variant', () => {
    const work: Work = {
      ...FULL_WORK,
      openalex_id: 'W7162097201',
    };
    renderCard(<WorkCard w={work} variant="production" />);
    const oaLinks = screen
      .getAllByRole('link')
      .filter((el) => el.getAttribute('href') === 'https://openalex.org/works/W7162097201');
    expect(oaLinks).toHaveLength(2);
    expect(oaLinks.every((el) => el.classList.contains('work-card__metric-ext-link'))).toBe(true);
  });

  it('renders openalex variant with authors and OA chip', () => {
    const work: Work = {
      t: 'External Publication',
      y: 2022,
      c: 9,
      s: 'PLOS ONE',
      oa: true,
      a: ['X. External', 'Y. Other', 'Z. Third', 'W. Fourth'],
      d: 'https://doi.org/10.5555/test',
      openalex_id: 'W999',
      impact: 1.1,
    };
    renderCard(<WorkCard w={work} variant="openalex" />);
    expect(screen.getByText('External Publication')).toBeDefined();
    expect(screen.getByText(/X\. External/)).toBeDefined();
    expect(screen.getByText(/\+1/)).toBeDefined();
    expect(screen.getByText('Acceso abierto')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Ver ficha/i })).toBeNull();
  });

  it('shows FWCI em dash for current-year works in openalex variant', () => {
    const work: Work = {
      t: 'Fresh Work',
      y: CURRENT_YEAR,
      c: 2,
      impact: 0.8,
      openalex_id: 'W100',
    };
    renderCard(<WorkCard w={work} variant="openalex" />);
    expect(screen.getByText('—')).toBeDefined();
    expect(screen.queryByText(/× la media del campo/)).toBeNull();
  });

  it('hides OA chip in openalex variant when not open access', () => {
    const work: Work = {
      t: 'Closed Work',
      y: 2021,
      c: 0,
      oa: false,
    };
    renderCard(<WorkCard w={work} variant="openalex" />);
    expect(screen.queryByText('Acceso abierto')).toBeNull();
  });

  it('links SDG chips to /ods/N in discovery variant', () => {
    renderCard(<WorkCard w={FULL_WORK} variant="discovery" />);
    const link = screen.getByRole('link', { name: /ODS/i });
    expect(link.getAttribute('href')).toBe('/ods/13');
  });

  it('renders coauthor variant with citas and without FWCI when no impact data', () => {
    const work: Work = {
      t: 'Lightweight Collab',
      y: 2020,
      c: 12,
      s: 'PLOS ONE',
      d: '10.1234/lightweight',
      oa: true,
      a: ['Ext Author'],
      field: 'Biology',
    };
    renderCard(<WorkCard w={work} variant="coauthor" />);
    expect(screen.getByText('Lightweight Collab')).toBeDefined();
    expect(screen.getByText('Acceso abierto')).toBeDefined();
    expect(screen.queryByText('Biology')).toBeNull();
    expect(screen.queryByText('Acceso UTA')).toBeNull();
    expect(screen.queryByText('FWCI')).toBeNull();
    expect(screen.getByText('Citas')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Acceder' })).toBeDefined();
  });

  it('lite coauthor card shows Citas tile when cited_by_count > 0 without local enrichment', () => {
    const work: Work = {
      t: 'OpenAlex only paper',
      y: 2019,
      c: 47,
      d: '10.1234/openalex-only',
      a: ['Co Author'],
    };
    renderCard(<WorkCard w={work} variant="coauthor" />);
    expect(screen.getByText('Citas')).toBeDefined();
    expect(screen.getByText('47')).toBeDefined();
    expect(screen.queryByText('FWCI')).toBeNull();
  });

  it('lite coauthor card shows FWCI tile when work is fwci-eligible', () => {
    const work: Work = {
      t: 'Impactful lite paper',
      y: 2020,
      c: 8,
      impact: 1.35,
    };
    renderCard(<WorkCard w={work} variant="coauthor" />);
    expect(screen.getByText('FWCI')).toBeDefined();
    expect(screen.getByText('1.35')).toBeDefined();
    expect(screen.getByText('Citas')).toBeDefined();
  });

  it('shows FWCI em dash for current-year works in coauthor variant', () => {
    const work: Work = {
      t: 'Fresh Collab',
      y: CURRENT_YEAR,
      c: 3,
      impact: 1.2,
    };
    renderCard(<WorkCard w={work} variant="coauthor" />);
    expect(screen.getByText('—')).toBeDefined();
  });

  it('shows Ver ficha for UTA coauthors in coauthor variant', () => {
    const work = linkedWork({ a: ['Ana Silva', 'Ext Author'] });
    const onOpenResearcher = vi.fn();
    renderCard(
      <WorkCard w={work} variant="coauthor" onOpenResearcher={onOpenResearcher} />,
    );
    const btn = screen.getByRole('button', { name: /Ver ficha/i });
    fireEvent.click(btn);
    expect(onOpenResearcher).toHaveBeenCalledWith('uta-1');
  });
});
