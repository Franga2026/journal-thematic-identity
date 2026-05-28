/**
 * Backward-compatible bridge — combines all 3 split contexts.
 * New components should use useUI(), useFilters(), useData() directly.
 */
import { useUI } from './UIContext';
import { useFilters } from './FiltersContext';
import { useData } from './DataContext';

export function useApp() {
  return { ...useData(), ...useUI(), ...useFilters() };
}

export { useUI } from './UIContext';
export { useFilters } from './FiltersContext';
export { useData } from './DataContext';

/** @deprecated Use AppProviders directly in tests and new code. */
export { default as AppProvider } from '../app/providers/AppProviders';
