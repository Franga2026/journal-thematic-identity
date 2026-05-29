# Despliegue IA (Claude) — Vercel y Cloudflare

La capa IA reutiliza un único adaptador (`src/server/aiApiAdapter.ts`) compartido por:

| Entorno | Entrada |
|---------|---------|
| `npm run dev` | Middleware Vite (`aiApiMiddleware.ts`) |
| Vercel producción | `api/ai/*.ts` → `createVercelAiHandler()` |
| Cloudflare Worker | `workers/ai-api-worker.ts` → `handleAiWebRequest()` |

El frontend siempre llama **`POST /api/ai/*`** (`src/api/aiApi.ts`). La API key **nunca** va al navegador.

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `ANTHROPIC_API_KEY` | Sí | Clave de Anthropic (solo servidor / Vercel / Worker secrets) |
| `ANTHROPIC_MODEL` | No | Modelo Claude (default con fallback en `claudeClient.ts`) |

### Vercel

1. Proyecto → **Settings** → **Environment Variables**
2. Añadir `ANTHROPIC_API_KEY` (Production, Preview, Development)
3. Opcional: `ANTHROPIC_MODEL` = `claude-3-5-sonnet-latest`

### Local

```bash
cp .env.example .env.local
# Editar ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

## Deploy en Vercel

```bash
npm i -g vercel   # si no está instalado
vercel login
vercel            # primera vez — enlazar proyecto
vercel --prod
```

`vercel.json` ya configura:

- **Build:** `npm run verify:data:stubs && npm run build` → carpeta `dist`
- **SPA:** rewrite a `index.html` (excepto `/api/*`)
- **Functions:** `api/ai/*.ts` con `includeFiles: src/**` para JSON locales en rutas que usan `ensureServerData()`

### Dataset en producción

Los endpoints `analyze-researcher`, `classify-sdg` y `analyze-coauthor` leen `src/*.json` en el servidor.

Para análisis completos en Vercel:

1. Subir los JSON reales al repo de deploy (o usar [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) / build step que copie `directorio-uta/src/*.json`), **o**
2. Aceptar stubs en build (`verify:data:stubs`) y usar sobre todo `summarize-work` + `chat` (contexto enviado por el cliente).

## Pruebas con curl

Sustituya `https://tu-proyecto.vercel.app` por su URL.

### Resumen de obra

```bash
curl -sS -X POST "https://tu-proyecto.vercel.app/api/ai/summarize-work" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Impacto del cambio climático en zonas áridas",
    "authors": ["García, A.", "López, B."],
    "journal": "Revista de Ciencias Ambientales",
    "year": 2023,
    "doi": "10.1234/example",
    "sdgs": ["SDG13", "SDG15"]
  }' | jq .
```

### Chat bibliométrico

```bash
curl -sS -X POST "https://tu-proyecto.vercel.app/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Qué áreas tienen más publicaciones en el directorio?",
    "context": {
      "investigators_count": 367,
      "publications_count": 9127,
      "top_fields": [{"field": "Medicina", "count": 120}]
    }
  }' | jq .
```

### Analizar investigador (requiere JSON en `src/` en el deploy)

```bash
curl -sS -X POST "https://tu-proyecto.vercel.app/api/ai/analyze-researcher" \
  -H "Content-Type: application/json" \
  -d '{"orcid": "0000-0001-2345-6789"}' | jq .
```

### Sin API key (debe devolver 503)

```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST "https://tu-proyecto.vercel.app/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"hola"}'
# Esperado: 503 y JSON con code missing_key
```

### Local (Vite dev)

```bash
curl -sS -X POST "http://localhost:5173/api/ai/summarize-work" \
  -H "Content-Type: application/json" \
  -d '{"title":"Prueba local","year":2024}'
```

## Cloudflare Worker (alternativa)

Rutas soportadas en Worker: **`chat`**, **`summarize-work`** (sin lectura de `src/*.json`).

```bash
cp workers/wrangler.toml.example workers/wrangler.toml
wrangler secret put ANTHROPIC_API_KEY
wrangler deploy
```

Configure el Worker delante de `/api/ai/*` o use el dominio del worker y actualice el frontend (`VITE_AI_API_BASE` — solo si el API está en otro origen).

Para las cinco rutas con dataset local, use **Vercel** como backend principal.

## Arquitectura

```
┌─────────────┐     POST /api/ai/*      ┌──────────────────────┐
│  React SPA  │ ──────────────────────►│ aiApiAdapter         │
│  aiApi.ts   │                        │  executeAiRoute()    │
└─────────────┘                        │       │              │
                                       │       ▼              │
                                       │  aiHandlers.ts       │
                                       │       │              │
                                       │       ▼              │
                                       │  claudeClient.ts     │
                                       └──────────────────────┘
```

## Seguridad

- Payload máximo ~32 KB por solicitud
- Prompts acotados (`promptBuilders.ts`); no se envía `all-works.json` completo
- Errores: `missing_key` (503), `rate_limit` (429), `timeout` (504), `payload_too_large` (413)
