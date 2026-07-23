# JIA v1.0.1 — Especificación Funcional

### Journal Identity Analytics · Referencia técnica del producto para CRIS Victoria (`cris-discovery-api`)

> **v1.0.1 — corrección de unidad de análisis y precisión normativa** (delta editorial sobre v1.0). No reescribe principios: una implementación, `p_doc`/`p_cit` separados, alertas `p_doc`-primarias, trazabilidad, bloqueo por paridad.
>
> **Naturaleza.** Documento **funcional y de arquitectura**, no de implementación. Es el contrato que Cursor (u otro implementador) debe seguir para construir el módulo sin introducir una segunda implementación del método ni romper la trazabilidad del paper.
>
> **Linaje.** Sucede a `docs/jia/spec_JIA_funcional_v1.0.md` (enmienda), `docs/jia/spec_JIA_v2.md`, `docs/jia/jia_schema_v2.1.sql` y `docs/jia/nota_diseno_journal_intelligence_v1.md`. **Subordinado al método del paper**: la verdad metodológica vive en el pipeline autorizado (`journal_identity_extract.py`, `prueba_A_prima.py`) y en los manuscritos congelados (v1.2 / v1.2.1). JIA **consume, versiona, valida y expone**; no recalcula.
>
> **Disciplina "la spec sigue al código":** donde se normaliza una fórmula (núcleo, JSD, desempate), la definición autorizada **es la de la función del pipeline** (`nucleo()` L87–92, `jsd()` L95 de `scripts/prueba_A_prima.py`). El texto documenta ese comportamiento **verificado**; si difieren, **manda el código**.
>
> **Estado:** `NORMATIVA — APROBADA PARA IMPLEMENTACIÓN` *(tras verificación de `nucleo()`/`jsd()`)*. Implementación de producto **posterior** al cierre de la ruta crítica del paper (v1.2.1 → réplica `p_doc` → traducción → envío).
>
> Ante cualquier divergencia futura entre documentación e implementación canónica, el despliegue queda **bloqueado** hasta reconciliar ambos mediante nueva versión y compuerta de paridad.

---

## Índice

0. Glosario y convenciones
1. Propósito y alcance — qué calcula y qué **no** calcula JIA
2. Principios rectores
3. Fuente de verdad y flujo de datos
4. Modelo de datos (esquema `jia.*` + extensiones)
5. Catálogo de indicadores — significado, fórmula, plano y modo de masa
6. Jobs autorizados
7. Contratos de API
8. Lógica de alertas
9. Guardarraíles metodológicos
10. Compuerta de paridad (obligatoria antes de desplegar)
11. Versionado, reproducibilidad y trazabilidad
11-bis. Estabilidad normativa y regla de semántica
12. Fases (v1.0 y diferido a v2)
13. No objetivos
14. Anexos (fórmulas, ejemplos JSON, manifiesto de paridad)

---

## 0. Glosario y convenciones

| Término | Definición |
|---|---|
| **`R_j`** | Representación temática observada de la revista *j*: distribución de subcampos derivada de su contenido. |
| **Identidad temática** | Inferencia **etiquetada** a partir de `R_j`; nunca una propiedad afirmada (Principio 1). |
| **`p_doc[s]`** | Participación **documental** del subcampo *s*: `D_{j,s} / D_j`. |
| **`p_cit[s]`** | Participación **citacional** del subcampo *s*: `C_{j,s} / C_j`. |
| **`mass_mode`** | Selector explícito `p_doc` \| `p_cit`. **Nunca** se mezclan ni promedian. |
| **Núcleo (Nτ)** | Ordénense los subcampos por participación descendente. Se incorporan secuencialmente hasta que la masa acumulada **alcanza o supera** τ; el subcampo cuya incorporación alcanza o supera el umbral **forma parte** del núcleo. `k* = min{ k : Σ_{i=1..k} p(i) ≥ τ }`, `Nτ = { s(1), …, s(k*) }`, τ = 0.50. **Desempate verificado:** `share DESC`, luego `subfield_id ASC` (`nucleo()` L87–92). Distribución vacía → núcleo vacío. |
| **config** | Etiqueta de ventana/parametrización (`W0_2021_2024`, `W+1_2022_2025`, …). Su identidad computacional es `config_hash`. |
| **run** | Ejecución autorizada del método (`jia.method_run`), con `config_hash`, `method_pkg_hash`, snapshot. |
| **Plano** | `observación` (`R_j`, descriptores) / `comparación` (vs ASJC editorial) / `inferencia` (etiquetada). |
| **Cohorte** | Las cifras 1 461 → 521 → 522 corresponden a la **cohorte canónica del estudio base**. **Cada run** registra su **propia cohorte efectiva**, elegibilidad, exclusiones y `n_panel` (p. ej. A′: panel común = 506). **Ninguna cifra de cohorte se codifica como constante del producto.** |
| **JSD operativa** | Exactamente `jsd()` de `prueba_A_prima.py` (L95): divergencia (no raíz) en base 2 (`log2`), soporte = unión de claves, KL solo donde `a > 0`. Ninguna biblioteca se considera equivalente sin paridad. |

**Convenciones:** hashes SHA256 completos (64 hex); **resultados científicos append-only** (ver §2 / §11); toda respuesta y todo resultado llevan trazabilidad (`config_hash`, `algorithm_version`, `snapshot_date`, `manifest_hash`) y, cuando aplica, `mass_mode` / `mass_modes` (§7).

---

## 1. Propósito y alcance

### 1.1 Qué calcula JIA

JIA **materializa y expone** —a partir de jobs autorizados que reusan el pipeline del paper— los siguientes productos por revista y por `config`/`mass_mode`:

1. **Identidad observada** (plano observación): perfil de subcampos, subcampo dominante, núcleo (τ=0.5), concentración (TCI/HHI), entropía (H, H_norm), impacto (JSS).
2. **Comparación editorial** (plano comparación, solo cohorte comparable): JCA, cobertura M, posición D, tipología M×D.
3. **Estabilidad temporal** (plano observación): S sobre `p_doc` interanual, con distribución de pares.
4. **Dinámica entre ventanas** (plano observación): JSD, Jaccard del núcleo, persistencia del dominante, correlaciones de forma entre `config` baseline y current, en modo dual `p_doc`/`p_cit`.
5. **Cambio temático (`topic_change`)** (plano observación, **descriptivo**): Δ de participación por subcampo entre ventanas. Sin umbrales validados no se etiqueta como "emergente".
6. **Diagnóstico de frontera del núcleo** (experimental): entradas/salidas cerca de `τ`, cambio de rango, distancia a `τ`. **No emite afirmación** hasta prueba estadística.
7. **Alertas operativas**: señales `p_doc`-primarias con corroboración `p_cit` condicionada a madurez.
8. **Ajuste de artículo** (`article_fit`, inferencial / **experimental**): distancia de un artículo nuevo a la identidad actual/histórica. **Información editorial, no recomendación.** **Fuera del mínimo desplegable de v1.0** — exige especificación metodológica propia antes de implementar.

### 1.2 Qué NO calcula JIA

- **No** recalcula identidad temática con un motor propio dentro del request.
- **No** reimplementa `_shares()`, JSD, Jaccard, núcleo, elegibilidad ni veredicto.
- **No** afirma identidad "verdadera"; **no** corrige el ASJC editorial; **no** acepta/rechaza manuscritos.
- **No** extrapola cobertura poblacional: todo agregado declara su cohorte.
- **No** mezcla `p_doc` con `p_cit`.
- **No** crea un stack de tablas paralelo a `jia.*`.
- **No** despliega sin superar la compuerta de paridad.

---

## 2. Principios rectores

1. **Una sola implementación metodológica.** La verdad de cálculo es el pipeline autorizado. Un indicador nuevo entra a JIA **solo** como job autorizado: método especificado + `algorithm_version` + config + manifest + paridad.
2. **Separación observación / inferencia (Principio 1).** Toda inferencia se construye a partir de `R_j` observado, nunca lo sustituye. La identidad se sirve como inferencia **etiquetada** (`note_code`), jamás como propiedad.
3. **`p_doc` y `p_cit` separados.** Modos distintos, columnas distintas, salidas distintas. `p_doc` gobierna las alertas operativas; `p_cit` corrobora.
4. **Resultados científicos inmutables (append-only); estados operativos auditados.** Los resultados (`journal_result`, `journal_topic_profile`, `window_comparison`, `window_comparison_summary`, `journal_stability`, …) **no se sobrescriben**: snapshot/config/algoritmo nuevos → fila nueva. Los **estados operativos** (`method_run.status`: `pending → running → completed`) y los **punteros de actualidad** pueden actualizarse, pero **toda transición queda auditada**. `is_current` **no** es un flag mutable en tablas de resultados: se resuelve con vista `v_current_run` (último run `completed` por config/`run_type`) **o** tabla-puntero `jia.current_run_pointer`.
5. **Paridad como condición de despliegue.** Si el producto no reproduce los números del paper para una muestra congelada, **no se despliega**.
6. **Trazabilidad total.** Toda respuesta y resultado incluyen config, snapshot, taxonomía, `mass_mode` y hash metodológico completo.

---

## 3. Fuente de verdad y flujo de datos

```
OpenAlex /works
   │  (ÚNICA implementación de shares)
   ▼
journal_identity_extract.py · _shares():  p_doc = d_s/docs ,  p_cit = c_s/cites
   ▼
journal_identity ──► journal_identity_profile   (por config)
                     journal_yearly_doc          (anual, p_doc)
   │  jobs autorizados (materialización JIA: reusan el pipeline, registran el run)
   ▼
jia.*  (config · method_run · journal_result · journal_topic_profile · journal_stability
         + window_comparison · core_boundary_diag · journal_alert · article_fit)
   ▼
cris-discovery-api  (lectura versionada; NUNCA cálculo por request)
   ▼
Frontend / CRIS Victoria
```

**Invariante:** ningún dato llega a `jia.*` sin un `run` registrado (`jia.method_run`) con `config_hash` y `method_pkg_hash`. La API lee `jia.*`; el job analítico se dispara **solo** al incorporar un snapshot, registrar una config o completar una reconstrucción autorizada.

---

## 4. Modelo de datos

### 4.1 Esquema existente (`jia_schema_v2.1.sql`) — se reusa tal cual

- **`jia.config`** — `config_uid` (uuid PK), `config_label`, `config_version`, `config_hash` (unique hex64), `window_start/end`, `snapshot_date`, `taxonomy_version`, `method_pkg_hash`.
- **`jia.method_run`** — `run_id`, `config_uid`, `snapshot_id`, `status`, `is_current`, `started_at`, `completed_at`; `chk_current_completed`. **Extensión v1.0:** columna `run_type` (`identity` \| `dynamics` \| `emergence` \| `boundary` \| `article_fit`).
- **`jia.journal_result`** — una fila revista×run: `frame_status`, `n_works`, `tci`, `h`, `h_norm`, `jss`, `jca`, `cobertura_m`, `d_cat`, `d_cont`, `tipologia_class`, `m_level`, `d_level`, `comparison_applicable`, `comparison_reason`.
- **`jia.journal_topic_profile`** — varias filas revista×run: `subfield_id`, `p_cit`, `p_doc`, `rank`, `cumulative_mass`, `is_nucleus`.
- **`jia.journal_stability`** — S por revista: `config`, `comparison_config`, `stability_s`, `n_pairs`, `pair_distribution`, `is_default`.
- **Vistas** `v_passport`, `v_typology_summary`; función `parity_check()`.

### 4.2 Reconciliación de lo propuesto → `jia.*`

| Propuesto | Resolución | Motivo |
|---|---|---|
| `journal_identity_snapshot`, `journal_topic_distribution` | **Reusar** `journal_result` + `journal_topic_profile` | Semántica idéntica. |
| `journal_core_membership` | **Vista** `v_core_membership` sobre `journal_topic_profile WHERE is_nucleus` | El flag ya existe. |
| `journal_monitor_run` | **Reusar** `method_run` (+`run_type`) | Un monitor run es un run. |
| `journal_stability_comparison` | **Nueva** `jia.window_comparison` (**nivel revista**) + `jia.window_comparison_summary` (**nivel panel**) | Comparación entre ventanas ≠ S intra-config. **Correlaciones de forma, veredicto de rejilla y `n_panel` viven solo en el summary.** |
| `journal_topic_emergence` | **Vista** `v_topic_change` (descriptiva); **no** "emergencia" etiquetada en v1.0 | Derivable de dos perfiles; job `topic_change`. |
| Diagnóstico de frontera | **Nueva** `jia.core_boundary_diag` (experimental) | Sin equivalente; veredicto nullable. |
| `journal_alert` | **Nueva** `jia.journal_alert` | Sin equivalente. |
| `article_journal_fit` | **Nueva** `jia.article_fit` | Sin equivalente. |

### 4.3 DDL de las tablas nuevas (borrador normativo)

```sql
-- Nivel revista: una fila por revista (métricas individuales).
CREATE TABLE jia.window_comparison (
    comparison_id       bigserial PRIMARY KEY,
    baseline_run_id     bigint NOT NULL REFERENCES jia.method_run(run_id),
    current_run_id      bigint NOT NULL REFERENCES jia.method_run(run_id),
    source_id           text NOT NULL,
    mass_mode           text NOT NULL CHECK (mass_mode IN ('p_doc','p_cit')),
    jsd                 double precision,
    core_jaccard        double precision,
    dominant_persisted  boolean,
    eligibility_status  text NOT NULL,
    algorithm_version   text NOT NULL,
    manifest_hash       text NOT NULL,
    computed_at         timestamptz NOT NULL,
    UNIQUE (baseline_run_id, current_run_id, source_id, mass_mode)
);

-- Nivel panel: una fila por (baseline × current × mass_mode).
-- Aquí viven correlaciones de forma, n_panel y el veredicto de la rejilla.
CREATE TABLE jia.window_comparison_summary (
    summary_id              bigserial PRIMARY KEY,
    baseline_run_id         bigint NOT NULL REFERENCES jia.method_run(run_id),
    current_run_id          bigint NOT NULL REFERENCES jia.method_run(run_id),
    mass_mode               text NOT NULL CHECK (mass_mode IN ('p_doc','p_cit')),
    n_panel                 integer NOT NULL,
    jsd_summary             jsonb NOT NULL,   -- {median,mean,p25,p75,iqr,p90,min,max}
    core_jaccard_summary    jsonb NOT NULL,   -- {median, pct_ge_090}
    dominant_persistence    double precision, -- fracción del panel
    shape_tci_pearson       double precision,
    shape_tci_spearman      double precision,
    shape_h_pearson         double precision,
    shape_h_spearman        double precision,
    shape_hnorm_pearson     double precision,
    shape_hnorm_spearman    double precision,
    grid_verdict            text,             -- p.ej. DEBILITA (nivel panel)
    algorithm_version       text NOT NULL,
    manifest_hash           text NOT NULL,
    computed_at             timestamptz NOT NULL,
    UNIQUE (baseline_run_id, current_run_id, mass_mode)
);

-- Diagnóstico de frontera del núcleo (EXPERIMENTAL; no afirma).
CREATE TABLE jia.core_boundary_diag (
    diag_id           bigserial PRIMARY KEY,
    comparison_id     bigint NOT NULL REFERENCES jia.window_comparison(comparison_id),
    source_id         text NOT NULL,
    mass_mode         text NOT NULL CHECK (mass_mode IN ('p_doc','p_cit')),
    entries           jsonb,   -- [{subfield, rank_prev, rank_curr, dist_to_tau}]
    exits             jsonb,
    rotation_concentrated_near_boundary boolean,   -- NULL hasta prueba estadística
    test_status       text NOT NULL DEFAULT 'not_run'
                       CHECK (test_status IN ('not_run','insufficient','tested')),
    algorithm_version text NOT NULL,
    computed_at       timestamptz NOT NULL
);

-- Alertas operativas (p_doc primaria).
CREATE TABLE jia.journal_alert (
    alert_id          bigserial PRIMARY KEY,
    source_id         text NOT NULL,
    comparison_id     bigint REFERENCES jia.window_comparison(comparison_id),
    alert_type        text NOT NULL,
    primary_mass_mode text NOT NULL DEFAULT 'p_doc' CHECK (primary_mass_mode = 'p_doc'),
    p_doc_status      text,
    p_cit_status      text,
    maturity_status   text,
    state             text NOT NULL,   -- ver §8
    severity          text,
    interpretation    text,
    evidence          jsonb,
    algorithm_version text NOT NULL,
    created_at        timestamptz NOT NULL
);

-- Ajuste de artículo (inferencial; información editorial, no recomendación).
CREATE TABLE jia.article_fit (
    fit_id             bigserial PRIMARY KEY,
    article_id         text NOT NULL,
    source_id          text NOT NULL,
    run_id             bigint NOT NULL REFERENCES jia.method_run(run_id),
    mass_mode          text NOT NULL CHECK (mass_mode IN ('p_doc','p_cit')),
    journal_fit        double precision,
    distance_current   double precision,
    distance_historical double precision,
    effect_on_dominant text,
    effect_on_core     text,
    novelty            text,
    note_code          text NOT NULL DEFAULT 'EDITORIAL_INFORMATION_NOT_RECOMMENDATION',
    algorithm_version  text NOT NULL,
    computed_at        timestamptz NOT NULL
);
```

Resultados **append-only**. `mass_mode` es columna, jamás un promedio. `core_boundary_diag` y `journal_alert` referencian el **nivel revista** (`comparison_id`). El **veredicto de A′ / rejilla** pertenece solo a `window_comparison_summary.grid_verdict`.

---

## 5. Catálogo de indicadores

Cada indicador declara: **plano**, **modo de masa aplicable**, **fórmula** e **interpretación/limitación**. Ninguno se sirve sin `mass_mode` y trazabilidad.

### 5.1 Plano observación (cohorte analítica; no requiere clasificación editorial)

| Indicador | Modo | Fórmula / definición | Interpretación · límite |
|---|---|---|---|
| **Perfil `R_j`** | p_doc / p_cit | Distribución normalizada de subcampos | Representación observada, no identidad. |
| **Dominante** | p_doc / p_cit | `argmax_s share[s]` (desempate `subfield_id ASC`, como `dominant()`) | Subcampo de mayor participación en la distribución observada. En A′ presentó una **persistencia elevada a nivel de panel**, pero su estabilidad **debe reportarse empíricamente para cada comparación**; en `p_cit` puede verse afectada por maduración. |
| **Núcleo** | p_doc / p_cit | `nucleo()` canónica: acumular hasta `Σ ≥ τ` (τ=0.5); incluye el subcampo que cruza | Composición central; sensible en el margen (τ). Ver §0 / §14.1. |
| **TCI / HHI** | p_doc / p_cit | `Σ_s share[s]²` | Concentración temática. |
| **Entropía H** | p_doc / p_cit | `−Σ_s share[s]·log share[s]` | Dispersión temática. |
| **H_norm** | p_doc / p_cit | `H / log(#subcampos)` | Dispersión normalizada [0,1]. |
| **JSS** | (citacional) | Percentil de impacto desde `discovery_cite_metrics` | Impacto relativo; se lee tal cual del pipeline. |
| **Estabilidad S** | **p_doc** | `1 − mean_t JSD(p_doc_t, p_doc_{t+1})` | Estabilidad interanual documental (evita rezago de citas). |

### 5.2 Plano comparación (solo cohorte comparable = 521; JOES ilustrativa, excluida)

| Indicador | Definición | Interpretación · límite |
|---|---|---|
| **JCA** | `Σ p_cit[s]` sobre `s ∈ E_j` (ASJC editorial) | Alineación con la clasificación editorial; **comparación**, no corrección. |
| **Cobertura M** | Fracción del núcleo cubierta intrínsecamente | Cobertura del núcleo declarado. |
| **Posición D** | núcleo / periferia / desplazada | Posición relativa; categórica. |
| **Tipología M×D** | matriz 2×2 | Solo para revistas `comparable`; `solo_contenido` → no aplica (`comparison_applicable=false`). |

### 5.3 Plano dinámica (entre ventanas; modo dual)

| Indicador | Modo | Definición | Interpretación · límite |
|---|---|---|---|
| **JSD masa** | p_doc / p_cit | `JSD(share_baseline, share_current)` | Redistribución de masa. En `p_cit`, sensible a maduración del año entrante. |
| **Jaccard núcleo** | p_doc / p_cit | `|N_base ∩ N_curr| / |N_base ∪ N_curr|` | Persistencia de la composición del núcleo. |
| **Persistencia dominante** | p_doc / p_cit | dominante_base == dominante_curr | Estabilidad de la disciplina principal. |
| **Correlaciones de forma** | p_doc / p_cit | Pearson r y Spearman ρ de TCI/H/H_norm **entre revistas del panel** | **Nivel panel** (`window_comparison_summary`). No son propiedades de un `source_id`. |
| **`grid_verdict` / status** | por modo | Vocabulario de la rejilla congelada del paper | **Nivel panel**. **No** se recalibran umbrales en el producto. |

### 5.4 Cambio temático (`topic_change`) — descriptivo

`Δshare[s] = share_current[s] − share_baseline[s]`; `relative_growth = share_current/share_baseline`. Se reportan por `mass_mode` con `label: null` y `evidence_status: "descriptive_only"`. **Sin umbrales validados no existe la etiqueta "emergente".** Un futuro job `topic_emergence` (inferencial) requiere método + umbrales + paridad; hasta entonces no alimenta afirmaciones ni alertas fuertes.

### 5.5 Frontera del núcleo (EXPERIMENTAL)

Entradas/salidas del núcleo con `rank_prev`, `rank_curr`, `dist_to_tau`. La afirmación *"la rotación se concentra en la frontera"* se sirve **`null`** hasta una prueba estadística suficiente (`test_status='tested'`). **Predicción, no hallazgo.**

### 5.6 `article_fit` (INFERENCIAL · EXPERIMENTAL · fuera del mínimo v1.0)

Tabla y principio conservados. **No** se implementa en el mínimo desplegable de v1.0 hasta especificación metodológica propia (`art_dist`, ponderación, artículos sin topics, normalización de `journal_fit`, pruebas de no-lectura como idoneidad editorial). `note_code = EDITORIAL_INFORMATION_NOT_RECOMMENDATION`. **Nunca** accept/reject.

---

## 6. Jobs autorizados

| Job | Estado | Entrada | Salida | Condición de entrada al producto |
|---|---|---|---|---|
| Construcción `p_doc`/`p_cit` | **Autorizado existente** | OpenAlex /works | `journal_identity(_profile)` | Ya validado por el paper. |
| Réplica A′ dual-mode | **Parametrización** | `journal_identity_profile` | `window_comparison` | Regresión `p_cit` == `manifest_A_prima.json`, luego `p_doc`. |
| Dinámica entre ventanas | **Autorizado tras paridad** | dos runs | `window_comparison` + `window_comparison_summary` | Reusa funciones de `prueba_A_prima.py`; paridad. Veredicto de rejilla solo en summary. |
| `topic_change` | **Descriptivo (v1.0)** | dos perfiles | vista / filas de Δ | Sin etiqueta "emergente"; `evidence_status=descriptive_only`. |
| Frontera del núcleo | **Experimental** | `window_comparison` | `core_boundary_diag` | No afirma hasta prueba; veredicto `null`. |
| `article_fit` | **Inferencial · fuera del mínimo v1.0** | artículo + run | `article_fit` | Requiere spec propia; nunca recomendación. |

Cada job registra un `method_run` con `run_type`, `config_hash`, `algorithm_version`, `snapshot`, `manifest_hash`.

---

## 7. Contratos de API

Toda respuesta incluye el **envelope obligatorio**; sin él, es inválida. Campos de modo e interpretación según escala:

**Modo de masa (sin default oculto; sin valor `n/a`):**
- Respuesta **monomodo:** `"mass_mode": "p_doc"` o `"p_cit"`.
- Respuesta **dual:** `"mass_modes": ["p_doc","p_cit"]`.
- Recursos donde el modo **no aplica** (`/meta`, `/runs/{id}/manifest`, `/comparison` — JCA citacional por definición): **omitir** ambos campos. No introducir un tercer valor semántico.

**Interpretación:**
- Respuesta **multiplano** (pasaporte): `"interpretation_scopes": ["observation","comparison","inference"]` y **cada bloque** conserva su `"scope"`.
- Respuesta **monoplano** (`/profile`, `/comparison`, `/stability`): `"interpretation_scope": "<único>"`.

```json
{
  "mass_mode": "p_doc",
  "config": "W+1_2022_2025",
  "config_hash": "<64 hex>",
  "algorithm_version": "…",
  "snapshot_date": "2026-07-…",
  "manifest_hash": "<64 hex>",
  "evidence_status": "confirmed | immature | insufficient | experimental | descriptive_only",
  "interpretation_scopes": ["observation","comparison","inference"],
  "data": {
    "observation": { "scope": "observation" },
    "comparison":  { "scope": "comparison" },
    "inference":   { "scope": "inference" }
  }
}
```

| Endpoint | Parámetros | Devuelve |
|---|---|---|
| `GET /identity/{source_id}` | `config`, `mass_mode` | Pasaporte multiplano (observation + comparison si aplica + inference etiquetada) |
| `GET /identity/{source_id}/profile` | `config`, `mass_mode` | Solo plano observación (`interpretation_scope=observation`) |
| `GET /identity/{source_id}/comparison` | `config` | Plano comparación; **200** con `applicable:false` si `solo_contenido`; **sin** `mass_mode` |
| `GET /identity/{source_id}/stability` | — | S + `pair_distribution` (siempre `p_doc`; `mass_mode` explícito `p_doc`) |
| `GET /identity/{source_id}/dynamics` | `baseline`, `current`, `mass_mode` | Métricas **individuales** (`window_comparison`) + alerta si corresponde |
| `GET /identity/dynamics/summary` | `baseline`, `current`, `mass_mode` | **Panel**: estadísticas + `grid_verdict` (`window_comparison_summary`) |
| `GET /identity/search` | `typology`, `config` | Lista por clase tipológica (cohorte del run) |
| `GET /identity/typology/summary` | `config` | Matriz 2×2 de la cohorte comparable del run |
| `GET /identity/runs/{run_id}/manifest` | — | Manifiesto del run (**sin** `mass_mode`) |
| `GET /identity/meta` | — | Configs (`config_hash`), ventana, taxonomía, hashes (**sin** `mass_mode`) |

**Códigos:** `200` (incl. no comparable), `404` (source/run inexistente), `409` reservado a conflicto de estado, `422` a solicitud semánticamente imposible. En endpoints monomodo de perfil/dinámica, `mass_mode` es **obligatorio**.

---

## 8. Lógica de alertas

**`p_doc` primaria; `p_cit` corroboración condicionada a madurez.**

**Política de madurez citacional (versionada).** La clasificación maduras/inmaduras **no se inventa en el producto**; proviene de una política explícita:

```json
{ "citation_maturity_policy": {
    "policy_version": "1.0.0",
    "unit": "months",
    "minimum_elapsed_months": null,
    "reference_date": "snapshot_date",
    "partial_year_handling": "define",
    "current_year_handling": "define",
    "source_of_rule": "define",
    "classification": "window_includes_immature_year" } }
```

Mientras la definición no exista: `maturity_status = "unknown"` y **ninguna alerta citacional se eleva a `CITATIONAL_CORROBORATION`**.

| `p_doc` | `p_cit` | Madurez | `state` | Severidad | Lectura |
|---|---|---|---|---|---|
| cambia | cambia | maduras | `CITATIONAL_CORROBORATION` | alta | Cambio documental confirmado y corroborado. |
| cambia | cambia | inmaduras | `OBSERVED_DOC_CHANGE` | media | Cambio documental confirmado; cita no concluyente. |
| cambia | estable | — | `OBSERVED_DOC_CHANGE` | media | Cambio en lo publicado, sin eco citacional aún. |
| estable | cambia | inmaduras | `CITATIONAL_SIGNAL_IMMATURE` | baja/suprimida | Probable rezago; **no** es reorganización. |
| estable | cambia | maduras | `DOC_CIT_DIVERGENCE` | media | Divergencia real producción↔recepción. |
| estable | estable | — | — | — | Sin alerta. |
| — | — | datos insuf. | `INSUFFICIENT_EVIDENCE` | — | Sin juicio. |

```json
{
  "alert_type": "core_change",
  "primary_mass_mode": "p_doc",
  "p_doc_status": "confirmed",
  "p_cit_status": "immature",
  "maturity_status": "window_includes_immature_year",
  "state": "OBSERVED_DOC_CHANGE",
  "interpretation": "Cambio observado en la composición documental; la evidencia citacional aún no es concluyente."
}
```

---

## 9. Guardarraíles metodológicos

- Identidad **observada**, no verdadera → inferencia etiquetada (`note_code`).
- Comparación con ASJC, **no** corrección del esquema editorial.
- `article_fit` **no** implica aceptación/rechazo.
- Frontera del núcleo = **hipótesis** hasta prueba (`test_status`); veredicto `null` por defecto.
- **Ausencia de evidencia ≠ estabilidad** (`INSUFFICIENT_EVIDENCE` es estado propio).
- `p_doc`/`p_cit` **separados** siempre; su diferencia es información.
- Los agregados **declaran su cohorte** (comparable/analítica); no se extrapola a población.

---

## 10. Compuerta de paridad *(obligatoria antes de desplegar cualquier versión)*

**Objetivo.** Garantizar que JIA reproduce **exactamente** el método del paper.

**Muestra.** Conjunto **congelado** de revistas (subconjunto representativo de la cohorte), versionado junto al test.

**Criterio.** Dado `(config, snapshot, mass_mode, parámetros)`, JIA debe producir respecto del pipeline autorizado / artefactos del paper (v1.2 / v1.2.1):

- **Valores discretos — coincidencia exacta:** subcampo dominante, conjunto del núcleo, `status`/tipología.
- **Flotantes — tolerancia explícita y documentada:** distribución, JSD, Jaccard, forma (p. ej. `|Δ| ≤ 1e-9`).
- **Cero diferencias no justificadas.**

**Política de despliegue.** Falla → **NO DEPLOY**. No se acepta "aproximadamente equivalente" sin análisis documentado. La compuerta corre en CI como *gate*, produce su propio manifiesto (`parity_report.json`) y usa `jia.parity_check()`.

**Validaciones de despliegue (cinco, heredadas de JIA v2 + una):**

1. **Paridad con el paper** (v1.2 / v1.2.1). 2. **Inmutabilidad** (snapshot nuevo no altera históricos). 3. **No comparabilidad** (`solo_contenido` nunca recibe JCA/M/D). 4. **Trazabilidad** (envelope completo con hash metodológico). 5. **Separación semántica** (ningún campo presenta identidad como propiedad ni ASJC "corregido"). 6. **Separación de modos** (`p_doc`/`p_cit` nunca mezclados; alertas `p_doc`-primarias).

---

## 11. Versionado, reproducibilidad y trazabilidad

- **`config_hash`** (serialización canónica de config): distingue ejecuciones con la misma etiqueta.
- **`method_pkg_hash`** (SHA256 del paquete metodológico autorizado): identifica la implementación.
- **`algorithm_version`**: versiona la lógica de cada job (incl. futura emergencia etiquetada).
- **`manifest_hash`**: hash del manifiesto del run.
- **Resultados append-only**; estados de run auditados (§2). Actualidad vía `v_current_run` / `current_run_pointer`, no flag mutable en resultados.
- Cada run registra **cohorte efectiva** y `n_panel`; no hay constantes de cohorte en el producto.
- Todo endpoint entrega el **SHA256 completo**; `short_hash` es solo lectura.

Esto mantiene la **reproducibilidad del paper dentro del producto**: cualquier resultado servido es rastreable a un run, una config y un paquete metodológico verificables.

---

## 11-bis. Estabilidad normativa y regla de semántica

| Nivel | Contenido | Regla de cambio |
|---|---|---|
| **A — congelado** | `_shares()`, soporte, núcleo, JSD, elegibilidad, rejilla/umbrales | Cambio exige **nueva versión metodológica + nueva paridad** |
| **B — versionable** | API, tablas auxiliares, vistas, envelopes | Cambio **compatible** mediante versión |
| **C — experimental** | frontera, emergencia etiquetada, `article_fit`, predicción | **No** puede alimentar afirmaciones ni alertas fuertes |

**Regla de semántica:** cambiar una **etiqueta** no autoriza cambiar la **semántica**. Todo cambio semántico exige **nueva `algorithm_version`**, aunque la estructura JSON permanezca igual.

---

## 12. Fases

**Fase 1 (v1.0 mínimo desplegable):** lectura de identidad autorizada · dinámica dual-mode (`window_comparison` + `window_comparison_summary`) · `topic_change` descriptivo · alertas `p_doc`-primarias (madurez versionada) · frontera **experimental** (`null` hasta prueba) · **paridad obligatoria**. **`article_fit` fuera del mínimo.**

**Fase 2 (posterior a validar métricas básicas):** `topic_emergence` (si umbrales aprobados) · predicción de cambio · clasificación de patrones · simulación editorial · `article_fit` (tras spec propia) · modelos longitudinales.

---

## 13. No objetivos

No recalcular en el request · no autoaceptar/rechazar manuscritos · no reemplazar ASJC · no crear un tercer stack · no mezclar `p_doc`/`p_cit` · no desplegar sin paridad · no convertir la frontera del núcleo en afirmación sin prueba · no extrapolar a población · no etiquetar "emergente" sin umbrales · no desplegar `article_fit` en el mínimo v1.0 · no poner correlaciones/veredicto de panel en filas por revista.

---

## 14. Anexos

### 14.1 Referencia de fórmulas *(spec sigue al código)*

```
share[s]      = mass[s] / Σ mass      (mass = d_s en p_doc; c_s en p_cit)
dominante     = argmax share; desempate subfield_id ASC   # dominant()
núcleo Nτ     = nucleo(dist, τ=0.5):
                orden (-share, subfield_id ASC);
                acumular hasta acc ≥ τ; el que cruza INCLUIDO;
                dist vacía → ∅
TCI/HHI       = Σ_s share[s]²                            # HHI()
H             = −Σ share·ln(share)  (natural; solo share>0)  # H()
H_norm        = H / ln(k), k=#subcampos>0                # Hnorm()
JSD(p,q)      = jsd() canónica:
                soporte = unión de claves;
                m = ½(p+q);
                ½ KL₂(p‖m) + ½ KL₂(q‖m)  con log2;
                KL solo donde a>0;
                = DIVERGENCIA (no √JSD / distancia)
Jaccard       = |N_p ∩ N_q| / |N_p ∪ N_q|
S             = 1 − mean_t JSD(p_doc_t, p_doc_{t+1})
```

**Definición operativa de JSD:** exactamente `jsd()` (`prueba_A_prima.py` L95). **Ninguna** implementación de biblioteca (p. ej. `scipy.spatial.distance.jensenshannon`, que devuelve la **distancia** = raíz) se considera equivalente **sin prueba de paridad**. Los valores del paper (JSD mediana 0.071, …) son los de `jsd()`. Igual criterio para HHI/entropía/Jaccard/núcleo: la biblioteca no define la semántica; la función autorizada sí.

**Verificación v1.0.1 (2026-07-23):** `nucleo()` confirma `≥ τ`, inclusión del elemento que cruza, desempate `(-share, id ASC)`, vacío → `∅`. `jsd()` confirma `log2`, divergencia (no raíz), unión de soporte, KL con máscara `a>0`.

### 14.2 Pasaporte de ejemplo (envelope + tres planos)

```json
{
  "mass_mode": "p_cit", "config": "W0_2021_2024", "config_hash": "…",
  "algorithm_version": "1.0.0", "snapshot_date": "2026-07-…", "manifest_hash": "…",
  "evidence_status": "confirmed", "interpretation_scope": "observation",
  "data": {
    "observation": { "profile": [], "nucleus": {}, "concentration": {}, "impact": {}, "temporal_stability": {} },
    "comparison":  { "applicable": true, "frame_status": "comparable", "jca": 0.0, "coverage": {}, "position": {}, "typology": {} },
    "inference":   { "status": "inferred", "principle": "P1",
                     "note_code": "OBSERVED_REPRESENTATION_NOT_INTRINSIC_IDENTITY",
                     "note": "Representación inferida del perfil observado; no es una propiedad intrínseca ni una corrección del esquema editorial." }
  }
}
```

### 14.3 Manifiesto de paridad de ejemplo (`parity_report.json`)

```json
{
  "sample_hash": "<hash de la muestra congelada>",
  "config": "W+1_2022_2025", "mass_mode": "p_doc",
  "method_pkg_hash": "<64 hex>", "float_tolerance": 1e-9,
  "checks": {
    "dominant_exact": "pass", "nucleus_set_exact": "pass",
    "jsd_within_tol": "pass", "jaccard_within_tol": "pass",
    "form_within_tol": "pass", "status_exact": "pass"
  },
  "verdict": "DEPLOY_ALLOWED",
  "unjustified_diffs": 0
}
```

---

*JIA v1.0.1 · especificación funcional **NORMATIVA — APROBADA PARA IMPLEMENTACIÓN** (tras verificación `nucleo()`/`jsd()`). Subordinada al método del paper (v1.2 / v1.2.1) y a `jia_schema_v2.1`. Secuencia de producto: DDL/migración → modelos de lectura → jobs autorizados → gate de paridad → endpoints → frontend. Implementación diferida al cierre de la ruta crítica del paper.*
