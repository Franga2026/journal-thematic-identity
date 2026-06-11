import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

vi.mock('../../utils/datasetUsage', () => ({
  fetchDataCiteUsage: vi.fn(),
}));

import { fetchDataCiteUsage } from '../../utils/datasetUsage';
import WorkCard from './WorkCard';
import { UIProvider } from '../../context/UIContext';
import type { DatasetRecord } from '../../shared/types';

const mockUsage = vi.mocked(fetchDataCiteUsage);

const baseDs: DatasetRecord = {
  openalex_id: 'W1',
  doi: 'https://doi.org/10.6084/m9.figshare.999',
  title: 'Dataset de prueba',
  year: 2024,
  authors: [],
  repo: 'Figshare',
  is_oa: true,
  access_url: 'https://doi.org/10.6084/m9.figshare.999',
  citas: 12,
  license: null,
};

const renderCard = (ds: DatasetRecord = baseDs) =>
  render(
    <MemoryRouter>
      <UIProvider>
        <WorkCard variant="dataset" ds={ds} />
      </UIProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockUsage.mockReset();
});

describe('WorkCard variant="dataset" — tiles de uso DataCite', () => {
  it('muestra Vistas y Descargas cuando ambos conteos > 0', async () => {
    mockUsage.mockResolvedValue({ viewCount: 15, downloadCount: 3, citationCount: 1 });
    renderCard();
    expect(await screen.findByText(/vistas/i)).toBeInTheDocument();
    expect(screen.getByText(/descargas/i)).toBeInTheDocument();
  });

  it('oculta Descargas (=0) pero muestra Vistas (>0)', async () => {
    mockUsage.mockResolvedValue({ viewCount: 8, downloadCount: 0, citationCount: 0 });
    renderCard();
    expect(await screen.findByText(/vistas/i)).toBeInTheDocument();
    expect(screen.queryByText(/descargas/i)).not.toBeInTheDocument();
  });

  it('oculta ambos cuando viewCount=0 y downloadCount=0', async () => {
    mockUsage.mockResolvedValue({ viewCount: 0, downloadCount: 0, citationCount: 5 });
    renderCard();
    await waitFor(() => expect(mockUsage).toHaveBeenCalled());
    expect(screen.queryByText(/vistas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/descargas/i)).not.toBeInTheDocument();
  });

  it('oculta Vistas/Descargas cuando DataCite devuelve null (sin registro)', async () => {
    mockUsage.mockResolvedValue(null);
    renderCard();
    await waitFor(() => expect(mockUsage).toHaveBeenCalled());
    expect(screen.queryByText(/vistas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/descargas/i)).not.toBeInTheDocument();
  });

  it('las Citas (OpenAlex) se muestran siempre, aunque DataCite sea null', async () => {
    mockUsage.mockResolvedValue(null);
    renderCard();
    expect(await screen.findByText('Citas', { exact: true })).toBeInTheDocument();
  });

  it('renderiza badge, repo, acceso abierto y enlace al título', () => {
    mockUsage.mockResolvedValue(null);
    renderCard();
    expect(screen.getByText('🗄️ Dataset')).toBeInTheDocument();
    expect(screen.getByText('Figshare')).toBeInTheDocument();
    expect(screen.getByText('Acceso abierto')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: baseDs.title });
    expect(link).toHaveAttribute('href', baseDs.access_url);
  });
});
