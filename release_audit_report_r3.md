# release_audit_report_r3.md — Auditoría de cierre · Ronda 3

**Fecha:** 2026-07-27  
**Rama:** `release-qss-v1`  
**Alcance:** localización / generación de evidencia / reporte. **Sin** editar manuscrito, Supplementary ni matriz. **Sin** marcar `✅`/`⚠`.  
**Regla dura:** ningún manifiesto se construyó copiando cifras del paper; solo salidas de pipeline o reejecución congelada + SHA-256 recalculado.

Evidencia auxiliar (dumps/logs de esta ronda): `release_audit_r3_evidence/`  
Catálogo de hashes: `release_audit_r3_evidence/sha256_catalog.json`

---

## Bloque A — Trazabilidad

### A.1 Cohorte (1461 · 521 · 522 · 6)

| Campo | Estado | Valor bruto | Regla | Valor publicado recomputado | N / modelo | Archivo fuente | SHA-256 |
|---|---|---|---|---|---|---|---|
| `n_frame` | **disponible** (regenerado) | 1461 | entero | 1461 | SQL live | `release_audit_r3_evidence/cohort_query_dump.json` | `30bf21d5279460158c63c5c49f988934bb26c48b1ce6fa4c710655d87048da3e` |
| `n_comparable` | **disponible** (regenerado) | 521 | entero | 521 | idem | idem | idem |
| `n_analytic` | **disponible** (regenerado) | 522 | entero | 522 | `journal_identity_summary` window_year=2024 | idem | idem |
| `n_subfields` | **disponible** (regenerado) | 6 | entero | 6 | path1 six | idem | idem |

- **¿Manifiesto JSON depositado?** No. No existe `manifest_*cohort*` en el repo.
- **Preexistente o regenerado:** regenerado por consulta SQL al estado actual de `journal_frame_index` / `journal_identity_summary` (misma DB del pipeline).
- **Definiciones operacionales usadas (no tomadas del paper):**
  - `n_frame` = `count(*)` donde `field_code ∈ {1311,2604,2716,3106,3109,3312}` **y** `in_content`
  - `n_comparable` = `frame_status='comparable'`
  - `n_analytic` = filas en `journal_identity_summary` con `window_year=2024`
  - `n_subfields` = distinct de esos seis códigos
- **Campos de nivel superior del dump:** `n_frame`, `n_comparable`, `n_analytic`, `n_subfields`, `count_by_subfield`, `dominant_share_W0_pcit`, `operational_defs`, `path1_six`.
- **Table S1 (conteos por subcampo, marco `in_content`):**  
  1311:83 · 2604:130 · 2716:6 · 3106:50 · 3109:28 · 3312:1164 (suma 1461).  
  Comparables: 49 · 53 · 1 · 25 · 8 · 385 (suma 521).
- **Script/runbook:** no hay runbook de “manifiesto cohorte”; el builder de marco es `scripts/build_journal_frame_index.py` (imprime stats; no escribe un manifiesto JSON canónico).

### A.2 Backward REF_A (0.046 · 1.00 · 0.822 · 0.83 · 0.90 · 0.76)

| Campo | Estado | Valor bruto | Regla | Publicado recomputado | ¿= REF_A? | Archivo / origen | SHA-256 |
|---|---|---|---|---|---|---|---|
| `jsd_median` | **disponible** | 0.04586137332403956 | 3 dec | 0.046 | sí | re-run `robustez_perfil.py` | log `7bd57bec…1af9` |
| `jaccard_median` (top-K) | **disponible** | 1.0 | 2 dec | 1.00 | sí | idem | idem |
| `dominant_pct` | **disponible** | 0.8218390804597702 | 3 dec | 0.822 | sí | idem | idem |
| `corr_TCI` | **disponible** | 0.8257416714087514 | 2 dec | 0.83 | sí | idem | idem |
| `corr_H` (raw) | **disponible** | 0.8976906404539603 | 2 dec | 0.90 | sí | re-run `diag_entropia_cola_A.py` cut=0 | log `61e4f060…6e32` |
| `corr_H_norm` | **disponible** | 0.7631743023926657 | 2 dec | 0.76 | sí | `robustez_perfil` (`corr entropía`) | `7bd57bec…` |

- **¿Manifiesto JSON depositado?** No (`manifest_backward*` ausente).
- **Trail empírico:** salida de pipeline `logs/robustez_perfil_A.log` (preexistente) + reejecución congelada idéntica; H cruda aportada por `diag_entropia_cola_A` (el script de robustez solo imprime una corr de entropía = H_norm).
- **N / modelo:** N = 522; par `W0_2021_2024` vs `W-1_2020_2023`; masa `p_cit`; τ = 0.5.
- **Nota técnica:** `robustez_perfil.jsd` usa **logaritmo natural (nats)**, no log2 (a diferencia del canónico A′). REF_A congela los redondeos de esta salida.
- **Dump estructurado:** `release_audit_r3_evidence/backward_metrics_raw.json` (SHA en catálogo).
- **REF_A en código** (capa normativa, no empírica): `scripts/prueba_A_prima.py` dict congelado — coincide con los redondeos anteriores.

### A.3 Descriptores / tipología M×D (insumo Figura 3)

| Campo | Estado | Valor bruto | Archivo fuente | SHA-256 |
|---|---|---|---|---|
| Matriz 2×2 | **disponible** | M-alta×D-cerca **415** · M-baja×D-cerca **70** · M-baja×D-lejos **36** · M-alta×D-lejos **0** | `data/md_intrinsecos_W0.csv` + log re-run | CSV `fd489fcd…4f20` |
| N tipología | **disponible** | 521 | idem | idem |
| `mean_dominant_share` (masa del subcampo líder) | **disponible** | mean max(`p_cit`) = **0.474507…** (median 0.4488), N=522 | `cohort_query_dump.json` ← SQL perfil W0 | `30bf21d5…` |
| Regresión JCA ~ M + D | **no disponible** | — | ningún artefacto/script produce ese R² | — |

- **Preexistente:** `data/md_intrinsecos_W0.csv`, `logs/md_intrinsecos_W0.log`.
- **Regenerado:** `python scripts/md_intrinsecos.py` → mismos conteos 415/70/36/0.
- **Definiciones (código, no paper):** ver Bloque C (`M`, `D`).
- **Cortes 2×2:** `M_ALTA = 0.5`; `D-cerca` = `D_cat=='núcleo'`; `D-lejos` = periferia ∪ desplazada.

### A.4 Estabilidad S (0.783 · 511) + robustez Figura 4

| Campo | Estado | Valor bruto | Regla | Publicado recomputado | Archivo | SHA-256 |
|---|---|---|---|---|---|---|
| `median_S` | **disponible** (preexistente) | 0.7830391698274216 | 3 dec | 0.783 | `data/stability_S_pdoc.csv` | `f1aa1178…8478` |
| `n_eligible` | **disponible** | 511 (`status=='ok'`) | entero | 511 | idem | idem |
| Vector S por revista | **disponible** | 522 filas (511 ok + 11 excl.) | — | — | idem (+ `data/S_pdoc_por_revista.csv`) | `9fcbc0f8…a65b` |
| IQR / P10 / P90 | **disponible** | IQR [0.7130, 0.8606]; P10 0.6306; P90 0.9114 | 3 dec típico | [0.713, 0.861]; 0.631; 0.911 | extract | `dee87775…7434` |

**Backward shift (Figura 4 / §6.3):** ver A.2 (JSD med 0.046, Jaccard 1.00, dominante 82.2 %, forma TCI/H/H_norm).

**Taxonomic coarsening (Prueba B)** — **disponible** (log preexistente + re-run):

| Estadístico | Valor bruto (re-run) | Archivo | SHA log re-run |
|---|---|---|---|
| N | 522 | `scripts/pruebaB_taxonomica.py` | `2da3fe17…a7c6` |
| B1 coincidencia dominante | 0.965 (conserv. 0.962) | idem | idem |
| B2 mediana Jaccard roll-up | 1.000; % J≥0.70 = 78.7% | idem | idem |
| B3 Spearman TCI / H_norm / H_raw | 0.683 / 0.620 / 0.772 | idem | idem |
| Veredicto | ESTRUCTURAL: ÉXITO PARCIAL; FORMA: FRACASO | idem | idem |

---

## Bloque B — R²: equivalencia de especificación

### Tabla de artefactos / modelos que producen un R² de JCA

| Fuente | N | Dependiente | Predictores | Modelo | Transformación | Tipo de R² | Subconjunto | R² | ¿= §6.2 QSS? |
|---|---|---|---|---|---|---|---|---|---|
| `data/jca_discriminant_2024.json` → `base_model` | 522 | JCA | \|E\| (`e_count`), `logN`, H (`h`=entropy_norm) | OLS | log(N) | R² ordinario | cohorte perfil (+JOES) | **0.392427…** | **no** (ver determinación) |
| Re-run `chequeo_jca_joes.py` / `validez_discriminante_jca.load_data` | 522 | JCA | \|E\| + logN + H | OLS | log(N) | R² | +JOES | 0.392427… | no |
| idem | 522 | JCA | \|E\| + logN + TCI_n | OLS | TCI/100 | R² | +JOES | 0.491854… | parcial (cae en 0.40–0.50) |
| idem | 522 | JCA | \|E\| + logN + H + TCI_n | OLS | — | R² | +JOES | 0.492579… | parcial |
| idem | **521** | JCA | \|E\| + logN + H | OLS | log(N) | R² | comparable sin JOES | **0.394809…** | no (piso 0.40) |
| idem | **521** | JCA | \|E\| + logN + TCI_n | OLS | TCI/100 | R² | sin JOES | **0.495676…** | parcial (dentro del rango, otra especificación) |
| idem | 521 | JCA | \|E\| + logN + H + TCI_n | OLS | — | R² | sin JOES | 0.496475… | parcial |
| Regresión **JCA ~ M + D** | — | — | — | — | — | — | — | **no disponible** | §6.2 QSS *describe* esto; **no hay artefacto** |

Dump exacto: `release_audit_r3_evidence/r2_models_exact.json`.  
JSON depositado: `cris-discovery-api/data/jca_discriminant_2024.json` SHA `52ad51c19896537a9008b535ab438858d5b020f93c95a48d4f7958cd1a81fbaa`.

### Determinación (sin editar el texto)

1. **Qué ejecutó el pipeline (capa empírica):** el discriminante de no-reducibilidad es  
   `JCA ~ |E_j| + log(N_j) + H_j` (y variantes con `TCI_n`), **no** `JCA ~ M + D`.  
   Fuente autoritativa del número “base” depositado: `jca_discriminant_2024.json` **R² = 0.392** (N=522).  
   Fuente autoritativa alineada con la cohorte comparable del paper ES: **N=521, modelo H → R² = 0.394809… ≈ 0.395**; benchmark conservador TCI → **0.495676… ≈ 0.496**.

2. **Qué dice §6.2 del draft QSS (capa presentación):** “regression of alignment on the **intrinsic descriptors**” con rango **0.40–0.50**. En el marco del propio draft, los descriptores intrínsecos son **M y D**. Eso **no coincide** con el modelo ejecutado (`|E|`, `logN`, H/TCI).

3. **0.392 frente a piso 0.40:** no es defendible por redondeo (0.392 → 0.39). Además el propio JSON fija `r2_survive_max = 0.4` y clasifica el modelo base como *sobrevive* precisamente porque R² **< 0.40**.

4. **Naturaleza de la discrepancia:**
   - **Metodológica** (principal): el modelo que §6.2 describe (alignment ~ coverage/position) **no es el modelo corrido**; no hay salida de `JCA ~ M + D`.
   - **Editorial** (secundaria, si se reinterpreta §6.2 como el discriminante estructural ES §5.5): el rango `0.40–0.50` mezcla el modelo H (~0.39–0.395, **fuera** del piso 0.40) con el benchmark TCI (~0.49–0.50). Habría que citar la(s) especificación(es) exactas, no un rango que borra el 0.392/0.395.

**Fuente autoritativa recomendada para el claim de separabilidad de JCA (como en el manuscrito ES congelado):** cohorte comparable N=521, modelos `chequeo_jca_joes` / `validez_discriminante_jca` (H → 0.395; TCI → 0.496).  
**No** usar `0.392` como si fuera “≈0.40–0.50”, ni afirmar que es R² de M×D.

---

## Bloque C — Supplementary `⟦…⟧` (extraídos, no escritos en el Supp)

### C.1 Completables ahora

| Placeholder Supp | Valor extraído | Archivo fuente | SHA-256 | Notas |
|---|---|---|---|---|
| Hash pre-registro (fwd) | `e08ce26c0a8f39b05d05aa1c1667301e79160810c5f8692f036b8862b648b982` | `cris-discovery-api/docs/paper2/preregistro_pruebaA_prima.md` | (el valor es el hash) | Documentary control vive en runbook (fila siguiente); no hay un único archivo “fwd+doc” fusionado |
| Hash runbook p_doc | `36b3a95e3ec44536084aeab71bf91155cc2512a96500584db04a242e2f678363` | `cris-discovery-api/docs/paper2/runbook_A_prima_pdoc_v1.0.md` | idem | |
| Hash script canónico | `08a0e48a293096f329caed0f85ce6806b49065b4974f4f807e970747ae838769` | `scripts/prueba_A_prima.py` | idem | coincide S5 |
| Hash manifiesto p_cit | `9fb560d7d53722a16125181f598cf678c2d1664ee055cacc5d39bd1322ed73ea` | `manifest_A_prima.json` | idem | **R2 confirmado** (nombre, rol, contenido, hash recalculado) |
| Hash manifiesto p_doc | `70d1ae785a4effd759d04de984228ff989f0fb5a7cfe674914636aa197ac86b4` | `manifest_A_prima_pdoc.json` | idem | completo 64 hex; **no** es origen Tabla 1 (panel común) |
| float_tol | `1e-12` | `audit_A_prima_consistency/audit_consistency_report.json` → `controls.10_manifiesto.float_tolerance` | `8322cdef…a84c` | |
| Table S2 (repro diff) | unexpected aggregate **0** · unexpected individual **0** | idem `10_manifiesto` | idem | |
| Input snapshot id | `9844f2c9e1dedd7328b5299702591c7c26da6f29c39fc67bcb04b3b2e9814ff3` | audit `11_entorno_datos` | idem | |
| Env lock | `3e5e937b316c05aeb0637b90687e4dd98182bc3581cb1c91017dbec46770305a` | `audit_prueba_A_prima_requirements.txt` | idem | |
| Definición operacional de **M** | `M = (Σ_{s ∈ K ∩ E_j} p_cit[s]) / (Σ_{s ∈ K} p_cit[s])` con núcleo K a τ=0.5 | `scripts/md_intrinsecos.py` L102–103 | — | “masa del núcleo cubierta por E_j / masa del núcleo” |
| Regla exacta de **D** | si `ej_mass < 0.05` → `desplazada`; else si `frac_core ≥ 0.50` → `núcleo`; else `periferia` (`FRAC_CORE_NUC=0.5`, `EPS_DESPL=0.05`) | `md_intrinsecos.py` L107–113 | — | EN Supp: nuclear / peripheral / displaced |
| Table S1 conteos | ver A.1 | `cohort_query_dump.json` | `30bf21d5…` | |

### C.2 Completables al final (no bloquean cifras; sí el PDF)

| Placeholder | Estado | Valor |
|---|---|---|
| URL del repositorio | **no disponible** en artefactos locales | — |
| DOI de Zenodo | **no disponible** | — |

---

## Resumen de disponibilidad (Ronda 3)

| Familia | ¿Disponible sin inventar? | Forma de la evidencia |
|---|---|---|
| Cohorte 1461/521/522/6 | sí | SQL regenerado (no JSON manifiesto previo) |
| REF_A backward | sí | re-run robustez + diag (no JSON manifiesto previo) |
| Tipología 2×2 + M/D | sí | CSV/log `md_intrinsecos` |
| mean dominant share ≈0.5 | sí | mean max(p_cit)=0.475 |
| Estabilidad S | sí | CSV preexistente |
| Robustez taxonómica | sí | re-run prueba B |
| R² §6.2 como JCA~M+D | **no** | discrepancia metodológica documentada |
| R² discriminante estructural | sí | JSON + re-run chequeo |
| Hashes / float_tol / S2 / M / D | sí | recalculados / leídos del código-auditoría |
| URL / DOI | **no** | — |

**Próximo paso (fuera de esta ronda):** re-run de verificación (§§1–10 de la matriz) marcando `✅`/`⚠` contra estas fuentes; luego decidir corrección editorial/metodológica del R² en el texto; rellenar `⟦…⟧` del Supp; producir Figuras 3–4.

---

*Ronda 3 · evidencia únicamente · manuscrito / Supplementary / matriz intactos.*
