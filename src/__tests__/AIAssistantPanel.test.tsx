import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AIAssistantPanel from '../components/ai/AIAssistantPanel';

describe('AIAssistantPanel', () => {
  it('muestra loading', () => {
    render(<AIAssistantPanel title="Test IA" loading />);
    expect(screen.getByRole('status').textContent).toMatch(/Generando análisis/);
  });

  it('muestra error', () => {
    render(<AIAssistantPanel title="Test IA" error="Fallo de conexión" />);
    expect(screen.getByRole('alert').textContent).toContain('Fallo de conexión');
  });

  it('muestra resultado y disclaimer', () => {
    render(
      <AIAssistantPanel
        title="Test IA"
        result={{
          ok: true,
          text: 'Análisis listo',
          disclaimer: 'Análisis generado por IA',
        }}
      />
    );
    expect(screen.getByText(/Análisis generado por IA/)).toBeTruthy();
    expect(screen.getByText('Análisis listo')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copiar análisis/i })).toBeTruthy();
  });
});
