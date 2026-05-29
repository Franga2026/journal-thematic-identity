import { useEffect, type ReactNode } from 'react';
import { UIProvider } from '../../context/UIContext';
import { DataProvider } from '../../context/DataContext';
import { FiltersProvider } from '../../context/FiltersContext';
import { loadAccessLookup } from '../../services/sources/sourceAccess';

interface Props { children: ReactNode; }

export default function AppProviders({ children }: Props): JSX.Element {
  useEffect(() => {
    loadAccessLookup();
  }, []);

  return (
    <DataProvider>
      <UIProvider>
        <FiltersProvider>
          {children}
        </FiltersProvider>
      </UIProvider>
    </DataProvider>
  );
}
