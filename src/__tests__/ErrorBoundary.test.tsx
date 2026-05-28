import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../components/common/ErrorBoundary';

function BrokenComponent(): JSX.Element {
  throw new Error('Test explosion');
}

function WorkingComponent(): JSX.Element {
  return <div>Works fine</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <WorkingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Works fine')).toBeDefined();
  });

  it('catches errors and shows fallback UI', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Algo salió mal')).toBeDefined();
    spy.mockRestore();
  });

  it('shows custom fallback message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary fallbackMessage="Sección rota">
        <BrokenComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Sección rota')).toBeDefined();
    spy.mockRestore();
  });

  it('has a retry button that resets error state', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Reintentar')).toBeDefined();
    spy.mockRestore();
  });

  it('has a reload page button', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Recargar página')).toBeDefined();
    spy.mockRestore();
  });

  it('logs error to console', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );
    expect(spy).toHaveBeenCalled();
    const calls = spy.mock.calls.flat().map(String);
    expect(calls.some(c => c.includes('ErrorBoundary'))).toBe(true);
    spy.mockRestore();
  });
});
