# Kit de integración — Identidad temática CRIS Victoria (fase 1)

Paquete de insumos para programar sobre **CRIS Victoria** (`cris_victoria` / `cris-discovery-api`) un módulo de:

- identidad temática,
- dinámica (estabilidad / respuesta no uniforme),
- temas emergentes,
- frontera del núcleo (predicción motivada; no clasificación automática aún),
- alertas.

**Fuera de fase 1:** predicción de cambio futuro y clasificación automática de patrones.

**Contrato de arquitectura (aprobado, no implementación):**  
`docs/jia/nota_diseno_journal_intelligence_v1.md` — módulo `journal-intelligence` = JIA operativo.  
**Contrato funcional de producto (v1.0.1 NORMATIVA):**  
`docs/jia/spec_JIA_funcional_v1.0.1.md` (enmienda de `spec_JIA_funcional_v1.0.md`) — qué calcula / qué no, indicadores, API, alertas, paridad, DDL extensiones.  
Este kit es material de apoyo; **no** autoriza improvisar esquema ni metodología.

Manuscrito de referencia: `docs/paper2/manuscrito_identidad_tematica_v1.2.1-es-final.md` (hipótesis emergente; confound `p_cit`).

---

## Inventario de este kit

| Qué pediste | Dónde está en el kit / repo |
|---|---|
| `scripts/prueba_A_prima.py` | `scripts/prueba_A_prima.py` (copia) · canónico: `cris-discovery-api/scripts/prueba_A_prima.py` |
| Función que construye `p_doc` / `p_cit` | `scripts/journal_identity_extract.py` → `_shares()` · persistencia `save_payload()` |
| Poblado multi-ventana | `scripts/populate_journal_identity_profile.py`, `populate_A_prima.py` |
| `p_doc` anual (estabilidad S) | `scripts/recompute_S_pdoc.py` → `journal_yearly_doc` |
| DDL OpenAlex / catálogo | `ddl/cris-victoria-schema.sql` (`sources`, `works`, `topics`, `openalex_*`) |
| DDL identity (extraído) | `ddl/journal_identity_tables.sql` |
| DDL JIA (capa producto) | `ddl/jia_schema_v2.1.sql` |
| Backend actual | ver §API abajo · código vivo: `main.py`, `catalog.py` |
| `requirements.txt` | `deps/requirements-api.txt` (+ `deps/requirements-analysis.txt`) |
| `package.json` (frontend) | `deps/package.json.excerpt.json` · canónico: raíz del monorepo |
| Manifest anonimizado | `ejemplos/manifest_A_prima.anon.json` |
| Contrato JSON propuesto | `api/contrato_identidad_v1.json` |

---

## Modelo de datos (resumen)

Dos stacks en el mismo Postgres:

```
A) Catálogo UTA (cris-victoria-schema.sql)
   institutions → researchers → authorships → works
   works.source_id → sources
   works ↔ topics (work_topics); topics.subfield/field/domain

B) Pipeline identidad / OpenAlex discovery
   openalex_sources (S…)
     → OpenAlex /works (filtro source + ventana)
     → buckets por primary_topic.subfield
     → p_doc = d_s/docs ; p_cit = c_s/cites
     → journal_identity (+ summary)
     → journal_identity_profile (por config: W0_…, W+1_…)
     → journal_yearly_doc (p_doc por año calendario)
   journal_asjc (ISSN → ASJC editorial)
```

**Fórmulas canónicas** (`journal_identity_extract._shares`):

```text
p_doc[s] = D_{j,s} / D_j
p_cit[s] = C_{j,s} / C_j
núcleo K = mínimo conjunto con Σ p ≥ τ (τ=0.5)  # en A′ sobre p_cit
```

---

## API actual y dónde exponer resultados

Hoy el API **no** sirve `journal_identity_profile` ni `p_doc`/`p_cit` directamente.

Rutas vivas (`main.py`):

| Ruta | Uso |
|---|---|
| `GET /search`, `/facets`, `/autocomplete` | Descubridor OpenAlex |
| `GET /ficha-descubridor.json` | Ficha frame/cuartiles (`journal_frame_index`) |
| `GET /source/{source_id}` | Detalle HTML fuente |
| `GET /researchers`, `/works`, … | Catálogo UTA (`catalog.py`) |

**Propuesta fase 1** (encajar junto a ficha/source; ver `api/contrato_identidad_v1.json`):

```text
GET /identity/{source_id}?config=W0_2021_2024&mass=p_cit|p_doc
GET /identity/{source_id}/dynamics?from=W0_2021_2024&to=W+1_2022_2025&mass=p_cit|p_doc
GET /identity/runs/{run_id}/manifest   # SHA-256 + umbrales + rejilla
```

Persistencia recomendada: tablas `jia.*` (`jia_schema_v2.1.sql`) — consumen el pipeline autorizado; **no** recalculan método en el request path.

---

## Alcance fase 1 vs fase 2

| Fase 1 (ahora) | Fase 2 (después) |
|---|---|
| Identidad (perfil, núcleo, dominante, forma) | Predicción de cambio futuro |
| Dinámica / respuesta no uniforme entre componentes | Clasificación automática de patrones |
| Temas emergentes (entradas al núcleo / gain de masa) | — |
| Frontera del núcleo (alerta + predicción motivada) | Validación empírica por rango |
| Alertas (JSD, Jaccard, dominante, maduración) | — |
| Modo `p_doc` **y** `p_cit` (mismo protocolo) | Elevar/degradar hipótesis según réplica `p_doc` |
| Manifest + SHA-256 | — |

---

## Dependencias

- API: `deps/requirements-api.txt` (FastAPI, psycopg, …)
- Análisis (scripts A′ / extract; hoy en `.venv`, no siempre pineados): `deps/requirements-analysis.txt`
- Frontend portal: monorepo `package.json` (Vite/React) — no es el runtime del motor

DSN típico: `postgresql://postgres:…@localhost:5432/cris_victoria` (`CRIS_DB_DSN` / `DSN`).

---

## Trazabilidad

Cada corrida debe emitir:

1. CSV/JSON por revista (métricas),
2. `manifest_*.json` (agregados + umbrales + celda de rejilla),
3. SHA-256 de ambos,
4. `metric_mass ∈ {p_cit, p_doc}`,
5. `config` / ventana / `computed_at`.

Ejemplo de forma: `ejemplos/manifest_A_prima.anon.json`.
