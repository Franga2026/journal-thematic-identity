# Portal de Investigadores — Universidad de Tarapacá

## Arquitectura Producción

```
src/
├── main.tsx                                # Entry point
├── App.tsx                                 # ErrorBoundary → Providers → Router
│
├── app/                                    # Orquestación
│   ├── providers/
│   │   └── AppProviders.tsx                # DataProvider → UIProvider → FiltersProvider
│   └── routes/
│       ├── AppRouter.tsx                   # BrowserRouter + lazy routes + modal layer
│       └── AppLayout.tsx                   # Header + StatsBar + Tabs + main + Footer
│
├── context/
│   ├── UIContext.tsx
│   ├── DataContext.tsx
│   ├── FiltersContext.tsx
│   └── AppContext.tsx                      # useApp() bridge (deprecated path)
│
├── shared/types/index.ts
├── bootstrap/initDataStore.js              # JSON → dataProcessing store (pre-render)
│
├── components/
│   ├── layout/                             # Header, StatsBar, TabNavigation, Footer
│   ├── tabs/                               # 10 pestañas lazy-loaded
│   ├── modals/
│   ├── cards/
│   └── common/
│
├── utils/
├── styles/app.css
└── __tests__/

index.html
vite.config.ts
vitest.config.ts
package.json
```

## Datos requeridos (JSON)

`src/bootstrap/initDataStore.js` importa estos archivos en `src/`:

| Archivo | Contenido |
|---------|-----------|
| `data.json` | Directorio de investigadores |
| `openalex.json` | Institución + perfiles OpenAlex por ORCID |
| `all-works.json` | Catálogo de publicaciones enriquecidas |
| `orcid-data.json` | Perfiles ORCID |
| `ai-data.json` | Resúmenes / gaps para pestaña IA |
| `coauthor-profiles.json` | Perfiles de coautores externos |
| `institutional-metrics.json` | Métricas institucionales |
| `researcher-metrics.json` | Métricas por investigador |

El repositorio incluye **stubs vacíos** para que `npm run build` funcione sin datos de producción. Reemplázalos por los JSON reales generados por tu pipeline (mismo esquema, mismos nombres de archivo).

## Setup

```bash
npm ci
npm run dev        # Desarrollo
npm run test       # Tests
npm run build      # Producción
npx tsc --noEmit   # Typecheck (CI; strict mode off until TS migration in PR3+)
```

Variables opcionales (pestaña IA / informes): `VITE_ANTHROPIC_KEY` en `.env`.

## Migración de contextos

```jsx
// Antes
import { useApp } from '../../context/AppContext';

// Después (menos re-renders)
import { useUI } from '../../context/UIContext';
import { useFilters } from '../../context/FiltersContext';
import { useData } from '../../context/DataContext';
```

## URLs (React Router)

| URL | Vista |
|-----|-------|
| `/perfiles` | Grid de investigadores |
| `/unidades` | Departamentos |
| `/areas` | Áreas de investigación |
| `/ods` | Objetivos de Desarrollo Sostenible |
| `/produccion` | Publicaciones con filtros |
| `/colaboradores` | Redes de co-autoría |
| `/ranking` | Rankings por métricas |
| `/metricas` | Dashboard institucional |
| `/ia` | Chat IA + Comparador + Redes |
| `/informes` | Informes + exportación |
