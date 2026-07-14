# CRIS Victoria — Descubridor bibliográfico universal (proxy FastAPI)

Proxy de búsqueda en vivo contra la API de OpenAlex (474M obras). La API key se guarda **solo en el servidor**; el frontend nunca la ve.

## Por qué existe este proxy

La API key de OpenAlex no puede ir en el frontend: cualquiera la vería en el navegador (F12 → Network) y gastaría tu saldo. Este proxy la mantiene en el servidor, y de paso añade **caché** (búsquedas repetidas no re-consultan) y **rate limit** (evita que alguien vacíe tu saldo).

## Arranque local

```bash
cd cris-discovery-api
pip install -r requirements.txt

# Configura tu key (obtenida en https://openalex.org/settings/api)
cp .env.example .env
# edita .env y pon tu OPENALEX_API_KEY real

# Carga las variables y arranca
export $(grep -v '^#' .env | xargs)
uvicorn main:app --reload --port 8000
```

Abre la documentación interactiva en http://localhost:8000/docs

> **Nota:** si el puerto 8000 está ocupado (p. ej. otra app local), usa `--port 8001` y ajusta `VITE_DISCOVERY_API_URL` en el frontend.

## Endpoints

| Endpoint | Qué hace |
|----------|----------|
| `GET /search?q=...` | Búsqueda OpenAlex en vivo |
| `GET /researchers` | Catálogo local (`q`, `unit`, `has_orcid`, `sdg`, `field`, `sort`, `page`, `per_page`) |
| `GET /researchers/{local_id}` | Investigador + métricas (NULL ≠ 0) |
| `GET /researchers/{id}/works` | Obras del investigador |
| `GET /units` | 32 unidades + cobertura ORCID |
| `GET /analytics/collaboration` | Obras por alcance: internacional / nacional / institucional |
| `GET /health` | Estado del proxy, Postgres y key |
| `GET /usage` | Saldo/uso restante en OpenAlex |

## Parámetros de `/search`

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `q` | texto | Términos de búsqueda (obligatorio, mín. 2 chars) |
| `page` | int | Página (1–200, default 1) |
| `per_page` | int | Resultados por página (1–50, default 25) |
| `year_from` | int | Año desde (opcional) |
| `year_to` | int | Año hasta (opcional) |
| `open_access` | bool | Solo acceso abierto (opcional) |
| `sort` | texto | `relevance` (default), `citations`, `date` |

### Ejemplo

```bash
curl "http://localhost:8000/search?q=gastric%20cancer%20chile&per_page=10&sort=citations"
```

Respuesta (resumida):

```json
{
  "query": "gastric cancer chile",
  "total": 1234,
  "page": 1,
  "per_page": 10,
  "cost_usd": 0.001,
  "cached": false,
  "results": [
    {
      "openalex_id": "W123...",
      "title": "...",
      "year": 2021,
      "doi": "10.xxxx/...",
      "cited_by_count": 340,
      "fwci": 4.8,
      "is_oa": true,
      "oa_status": "gold",
      "journal": "Nature Genetics",
      "authors": [{"name": "...", "orcid": "..."}]
    }
  ]
}
```

## Costo

Cada búsqueda cuesta ~10 créditos de OpenAlex ≈ USD 0.0001–0.001. Con tu key gratuita (USD 1/día ≈ 1.000 búsquedas) o un prepago de USD 50, cubres decenas de miles de búsquedas. El campo `cost_usd` de cada respuesta te dice el costo real, y `GET /usage` te muestra el saldo restante.

La caché (1h por defecto) hace que búsquedas repetidas **no** gasten saldo.

## Despliegue en producción

1. Sube el código a tu servidor (o un servicio como Railway, Render, Fly.io).
2. Configura las variables de entorno (sobre todo `OPENALEX_API_KEY` y `ALLOWED_ORIGINS` con el dominio real del portal).
3. Corre con un servidor de producción:

   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
   ```

4. Ponlo detrás de HTTPS (nginx/Caddy o el proxy del hosting).

## Notas de producción

- La caché y el rate limit actuales son **en memoria** (se pierden al reiniciar y no se comparten entre instancias). Para escala real, migrar a Redis.
- `ALLOWED_ORIGINS` debe listar **solo** tu dominio real, no `*`.
- Considera añadir autenticación si el proxy no debe ser público.

## Frontend (directorio-uta)

El servicio TypeScript vive en `src/services/discovery/universalSearch.ts`. Configura en `.env.local`:

```bash
VITE_DISCOVERY_API_URL=http://localhost:8000
```
