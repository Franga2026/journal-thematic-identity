# Portal de Investigadores — Universidad de Tarapacá

React + Vite. **Sin backend en este repo.** Los datos del portal son JSON estáticos en `src/`.

```
React → JSON locales (src/*.json) → initDataStore → Contexts → Tabs
```

> **No usar** *catalogador-ia* ni su FastAPI (`GET /records`, etc.). Es **otro proyecto** — no comparte código, puertos ni `.env` con este repo.  
> El descubridor OpenAlex usa solo `cris-discovery-api/` + `VITE_DISCOVERY_API_URL` (ver `.cursor/rules/no-catalogador-ia.mdc`).

## Proyecto activo

Abre en Cursor solo esta carpeta:

```
directorio-uta 7/
```

## Datos: qué va en git y qué no

| En git | Fuera de git |
|--------|----------------|
| `src/data-stubs/*.json` (mínimos, para CI) | Los 8 JSON grandes en `src/` (dataset real ~28 MB) |

### Archivos requeridos en `src/` (locales, gitignored)

| Archivo | Contenido |
|---------|-----------|
| `data.json` | Directorio de investigadores |
| `openalex.json` | Institución + autores OpenAlex |
| `all-works.json` | Publicaciones |
| `orcid-data.json` | Perfiles ORCID |
| `ai-data.json` | Datos pestaña IA |
| `coauthor-profiles.json` | Coautores externos |
| `institutional-metrics.json` | Métricas institucionales |
| `researcher-metrics.json` | Métricas por investigador |
| `data/work-citations.json` | Índice de citas APA/IEEE/Vancouver/BibTeX/RIS |

### Restaurar dataset real (desarrollo local)

Copia desde la carpeta de referencia (mismo esquema de nombres):

```text
directorio-uta/src/
        ↓
directorio-uta 7/src/
```

Comandos:

```bash
# Recuperación rápida (JSON + fotos + autores_uta + índice de citas)
npm run restore:data

# Solo copiar JSON y fotos (sin link:works ni citas)
npm run setup:data

# Opción 2 — manual
cp ../directorio-uta/src/data.json \
   ../directorio-uta/src/openalex.json \
   ../directorio-uta/src/all-works.json \
   ../directorio-uta/src/orcid-data.json \
   ../directorio-uta/src/ai-data.json \
   ../directorio-uta/src/coauthor-profiles.json \
   ../directorio-uta/src/institutional-metrics.json \
   ../directorio-uta/src/researcher-metrics.json \
   src/

# Verificar antes de build con datos reales
npm run verify:data
```

### Fotos de perfil

Las imágenes **no** van en `src/`: Vite las sirve desde:

```text
public/photos/     ← p. ej. 04892498-0.jpg (campo ph en data.json)
```

Se copian con `npm run setup:data` desde `directorio-uta/public/photos/` (173 archivos). Sin esta carpeta verás solo iniciales.

Tras copiar, reinicia Vite. En consola deberías ver:

```text
[initDataStore] 367 investigadores, 9127 publicaciones, …
```

## Setup

```bash
npm ci
npm run setup:data      # si aún no tienes los JSON en src/
npm run verify:data     # obligatorio antes de build “real”
npm run dev             # http://localhost:5173
npm run test
npm run build           # ejecuta verify:data automáticamente
```

Solo comprobar que existen archivos (p. ej. tras copiar stubs en CI):

```bash
npm run verify:data:stubs
```

### Asistente IA (Claude)

La API key **no** va en el frontend. Solo servidor: `ANTHROPIC_API_KEY` y opcional `ANTHROPIC_MODEL` (ver `.env.example`).

| Entorno | Backend |
|---------|---------|
| `npm run dev` | Middleware Vite → `aiApiAdapter` |
| **Vercel** | `api/ai/*.ts` → mismos handlers |
| Cloudflare (opc.) | `workers/ai-api-worker.ts` — chat y summarize-work |

El cliente usa siempre **`POST /api/ai/*`** (`src/api/aiApi.ts`).

**Despliegue Vercel, variables, curl y Worker:** [docs/DEPLOY-AI.md](docs/DEPLOY-AI.md)

**Repositorio ANID (OAI-PMH, API REST, conteos UTA):** [docs/repositorio-anid-oai.md](docs/repositorio-anid-oai.md)

UI: **Resumen IA** (obras), **Analizar con IA** (perfiles), análisis ODS/coautores, chat en pestaña **IA**.

## Carga de datos

`main.tsx` → `bootstrap/initDataStore.js` → `initData()` en `utils/dataProcessing.js`.

## Arquitectura UI

```
App → ErrorBoundary → AppProviders → AppRouter
```

Rutas: `/perfiles`, `/unidades`, `/areas`, `/ods`, `/produccion`, `/ranking`, `/metricas`, `/informes`. Co-autores: desde la ficha del investigador (Co-autores principales). Resúmenes IA: en fichas de investigador, colaborador y publicaciones.

### Co-autores / Colaborador internacional

El modal de colaborador (`CoAuthorModal`) y las métricas de colaboración UTA dependen de obras en `all-works.json` con el campo `autores_uta` vinculado a investigadores UTA.

Si un colaborador tiene colaboraciones detectadas, pero el modal muestra el **listado de publicaciones vacío**:

> Este colaborador tiene colaboraciones detectadas, pero no hay obras enlazadas en all-works. Ejecute `npm run link:works` para regenerar vínculos.

```bash
npm run link:works
```

Luego reconstruir/verificar: `all-works.json` (`autores_uta`), `coauthor-profiles.json`, métricas de colaboración (`resolveCoAuthorProfile`) y el listado en `CoAuthorModal`.

Referencia en código: `src/utils/coAuthorsTechnicalNote.ts`.

### API vincular colaboradores

En dev/preview, Vite expone:

```http
POST /api/collaborators/link
Content-Type: application/json

{ "orcid": "0000-0002-2222-2222", "fetchOpenAlex": true, "persist": false }
```

```http
GET /api/collaborators/{orcid}/link?persist=1
```

Pipeline: `linkAutoresUta` → authorships (ORCID/nombre) → cruce coautor+UTA → OpenAlex DOIs.

En el cliente: `linkCollaboratorWorks()` desde `src/api/collaboratorsApi.ts` (misma lógica; el modal usa este método).

Con `persist: true` en dev, actualiza `src/all-works.json` en disco (equivalente a `npm run link:works` ampliado).

### Citas bibliográficas

```bash
npm run index:citations
# opcional: enriquecer metadatos faltantes vía Crossref
npm run index:citations -- --crossref
```

Genera `src/data/work-citations.json` desde `all-works.json`. En la UI, cada `WorkCard` incluye **Citar** (APA 7, IEEE, Vancouver, BibTeX, RIS — copiar o descargar).

Helper: `buildCitation(work, 'apa' | 'ieee' | 'vancouver' | 'bibtex' | 'ris')` en `src/utils/citation/`.

## Migración de contextos

Preferir `useUI()`, `useFilters()`, `useData()` frente a `useApp()`.
