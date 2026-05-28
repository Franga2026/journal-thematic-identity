import type { ReactNode } from 'react';
import { UIProvider } from '../../context/UIContext';
import { DataProvider } from '../../context/DataContext';
import { FiltersProvider } from '../../context/FiltersContext';

interface Props { children: ReactNode; }

export default function AppProviders({ children }: Props): JSX.Element {
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
