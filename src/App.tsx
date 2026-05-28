import ErrorBoundary from './components/common/ErrorBoundary';
import AppProviders from './app/providers/AppProviders';
import AppRouter from './app/routes/AppRouter';
import './styles/app.css';

export default function App(): JSX.Element {
  return (
    <ErrorBoundary fallbackMessage="Error crítico en la aplicación. Recargue la página.">
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </ErrorBoundary>
  );
}
