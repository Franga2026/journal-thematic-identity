import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapData } from './bootstrap/initDataStore';
import SplashScreen from './components/common/SplashScreen';
import App from './App';

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <SplashScreen />
  </StrictMode>,
);

bootstrapData()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((err) => {
    console.error('[bootstrapData] Error cargando datos:', err);
    const el = document.getElementById('root');
    if (el) {
      el.innerHTML =
        '<p style="font-family:system-ui;padding:2rem;color:#14314e">No se pudieron cargar los datos del portal. Revisa la consola y que existan los JSON en <code>/data/</code>.</p>';
    }
  });
