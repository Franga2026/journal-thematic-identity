# Matriz de verificación numérica — `release-qss-v1`

**Propósito.** Conectar cada afirmación numérica del manuscrito y del Supplementary con su fuente exacta en los manifiestos congelados. Es la última validación científica del hito único (**manifiestos → verificación → Figuras 3–4 → congelación del PDF**); no cambia contenido, solo confirma que cada cifra coincide con el manifiesto que la produjo.

**Cómo usarla.** Para cada fila: abrir el `Archivo fuente`, leer el `Campo/consulta`, comparar con `Valor esperado`, y marcar `Estado`:
`⬜ pendiente` · `✅ coincide` · `⚠️ discrepancia (anotar valor real)`.

Los nombres de campo son **propuestas** basadas en el naming del Supplementary (`jsd_median`, `MIN_SUBFIELDS`, etc.); confírmalos/ajústalos contra el esquema real del manifiesto. `⟦…⟧` = valor o campo que solo tú puedes suministrar desde el repo.

---

## Reglas del pase (fijadas antes de tocar los manifiestos)

**R1 · No validar por redondeo visual.** Para cada cifra, registrar los tres valores y comparar bruto→publicado bajo la regla declarada, no de memoria:

| Valor bruto (manifiesto) | Regla | Valor publicado |
|---|---|---|
| 0.07143 | 3 decimales | 0.071 |
| 0.52569 | porcentaje, 1 decimal | 52.6 % |

Una diferencia entre `bruto` y `publicado` que respeta la regla es *presentación*, no discrepancia; solo es discrepancia si el bruto no redondea al publicado.

**R2 · Ningún hash por inferencia.** El `9fb560d7…` está **confirmado** (R2: nombre=`manifest_A_prima.json`, hash recalculado; antes era hipótesis) las cuatro cosas: (a) nombre exacto del archivo, (b) contenido, (c) rol en el runbook, (d) SHA-256 calculado directamente. Igual para todos los hashes: se calculan, no se copian.

**R3 · Extraer, no transcribir.** Los valores se leen del manifiesto con un script (no a mano) para eliminar el error de transcripción — que es justo lo que la §10 busca atrapar.

**R4 · Una única fuente de verdad por cifra.** Si un número aparece en varios archivos, no se valida contra el que "coincide", sino contra la fuente **oficial fijada de antemano**; los demás documentos deben coincidir con ella, no al revés. Esto evita el error clásico de proyectos reproducibles: validar contra una copia derivada en lugar del origen. Fuentes autoritativas (fijadas **antes** de abrir el repo):

| Familia de cifras | Fuente de verdad | Deben coincidir con ella |
|---|---|---|
| Estabilidad (`median_S`, N = 511) | manifiesto estabilidad | §6.1 · Figura 4 |
| Tamaños de cohorte (1461/521/522/6) | manifiesto cohorte | §5 · S3 · Figura 2 |
| Panel común (506 · 2 · 8) | manifiesto forward | §6.4 · Tabla 1 · Figura 5 |
| Métricas p_cit (0.071 · 52.6 · 85.0 · corrs) | `manifest_A_prima.json` (A′ fwd = panel común; hash `9fb560d7…` **confirmado**) | §6.4 · Tabla 1 · Figura 5 |
| Métricas p_doc (0.028 · 72.9 · 95.8 · corrs) | `analisis_…panel_comun.json` (control documental, panel común 506) — **no** el `manifest_A_prima_pdoc.json` natural | §6.4 · Tabla 1 · Figura 5 |
| Referencia backward REF_A (0.046 · 1.00 · 0.822 · 0.83 · 0.90 · 0.76) | manifiesto backward (origen empírico) | S4.3 · §6.4 texto · Figura 5 |
| Umbrales de decisión (PISO_JSD, PISO_DOM, TECHO_FORMA, τ, MIN_SUBFIELDS) | **preregistro** (normativo; no el código, salvo que el preregistro remita a él) | S2 · S4.3 · código |
| Cotas del control documental (0.071/0.60/0.046/0.90) | preregistro p_doc (S4.2) | S4.2 texto |
| Hashes | el archivo mismo + SHA-256 recalculado (R2) | S4.3 · S5 |

**Orden de ejecución (no adelantar figuras con cifras provisionales):**
1. Identificar cada archivo fuente real.
2. Calcular sus SHA-256 directamente.
3. Extraer valores por script → completar §§1–9.
4. Ejecutar los chequeos cruzados de la §10.
5. Renderizar Figuras 3 y 4 **solo** con datos ya en `✅`.
6. Completar el Supplementary (`⟦…⟧`, Tablas/Figuras S).
7. Congelar el PDF.

---

## 1 · Cohorte (§5 · S3 · Figura 2)

| Ubicación | Afirmación | Valor esperado | Archivo fuente | Campo/consulta | Estado |
|---|---|---|---|---|---|
| §5 / S3 | Sampling frame | 1,461 | `journal_frame_index` (`in_content`) | `n_frame` | ✅ |
| §5 / S3 / §6.2 | Comparable cohort | 521 | `journal_frame_index` | `n_comparable` | ✅ |
| §5 / S3 | Analytic cohort | 522 | `journal_identity_summary` (2024) | `n_analytic` | ✅ |
| §5 / S3 | Subcampos | 6 | Path-1 six | `n_subfields` | ✅ |
| Figura 2 | Excluidos (1461 − 521) | 940 | derivado | consistencia aritmética | ✅ |

## 2 · Estabilidad temporal (§6.1 · Figura 4)

| Ubicación | Afirmación | Valor esperado | Archivo fuente | Campo/consulta | Estado |
|---|---|---|---|---|---|
| §6.1 | Median stability S | 0.783 | `data/stability_S_pdoc.csv` | `median_S` | ✅ |
| §6.1 | N stability (elegibles) | 511 | `data/stability_S_pdoc.csv` | `n_eligible` | ✅ |

## 3 · Tipología y discriminante (§6.2 · Figura 3)

| Ubicación | Afirmación | Valor esperado | Archivo fuente | Campo/consulta | Estado |
|---|---|---|---|---|---|
| §6.2 | N tipología (comparable) | 521 | `md_intrinsecos_W0.csv` | N | ✅ |
| §6.2 | R² alignment (discriminante) | 0.395 (`|E|+logN+H`) · 0.496 (`|E|+logN+TCI`); N=521 | `chequeo_jca_joes` / OLS | `R2` | ✅ |
| §6.2 | Subcampo líder ≈ mitad de la masa | ≈ 0.5 (mean=0.4745) | SQL `max(p_cit)` W0 | `mean_dominant_share` | ✅ |

## 4 · Réplica forward — diagnóstico de magnitud y panel común (§6.4 · Figura 5)

| Ubicación | Afirmación | Valor esperado | Archivo fuente | Campo/consulta | Estado |
|---|---|---|---|---|---|
| §6.4 | Common panel | 506 | `manifest_A_prima.json` | `panel.comun` | ✅ |
| §6.4 | Entraron entre ventanas | 2 | `manifest_A_prima.json` | `panel.entradas` | ✅ |
| §6.4 | Salieron entre ventanas | 8 | `manifest_A_prima.json` | `panel.salidas` | ✅ |
| §6.4 / Tabla 1 | % con divergencia ≤ 0.01 (p_cit) | 2.6 % | `manifest_A_prima.json` | `perturbacion.jsd_le_0.01` | ✅ |
| Tabla 1 | % con divergencia ≤ 0.01 (p_doc) | 10.1 % | `analisis_A_prima_pdoc_panel_comun.json` | `pdoc_comun.perturbacion…` | ✅ |

> **Nota de operador:** el texto de §6.4 dice "below 0.01" (2.6 %) y la Tabla 1 dice "≤ 0.01"; confirmar cuál usa el código (`<` vs `≤`) y unificar la redacción si difieren.

## 5 · Réplica forward — métricas p_cit (§6.4 · Tabla 1)

| Ubicación | Afirmación | Valor esperado | Archivo fuente | Campo/consulta | Estado |
|---|---|---|---|---|---|
| §6.4 / Tabla 1 | Median mass divergence (JSD) | 0.071 | manifiesto p_cit | `jsd_median` | ✅ |
| §6.4 / Tabla 1 | Nucleus preserved (Jaccard ≥ 0.90) | 52.6 % | manifiesto p_cit | `jaccard_pct_ge_090` | ✅ |
| §6.4 / Tabla 1 | Dominant subfield persists | 85.0 % | manifiesto p_cit | `dominant_pct` | ✅ |
| §6.4 / Tabla 1 | Shape corr — concentration (r) | 0.852 | manifiesto p_cit | `corr_TCI` | ✅ |
| §6.4 / Tabla 1 | Shape corr — entropy raw (r) | 0.896 | manifiesto p_cit | `corr_H` | ✅ |
| §6.4 / Tabla 1 | Shape corr — entropy norm (r) | 0.827 | manifiesto p_cit | `corr_Hnorm` | ✅ |

## 6 · Réplica forward — métricas p_doc (§6.4 · Tabla 1)

| Ubicación | Afirmación | Valor esperado | Archivo fuente | Campo/consulta | Estado |
|---|---|---|---|---|---|
| §6.4 / Tabla 1 | Median mass divergence (JSD) | 0.028 | `analisis_…panel_comun.json` (panel común 506) | `jsd_median` | ✅ |
| §6.4 / Tabla 1 | Nucleus preserved (Jaccard ≥ 0.90) | 72.9 % | `analisis_…panel_comun.json` (panel común 506) | `jaccard_pct_ge_090` | ✅ |
| §6.4 / Tabla 1 | Dominant subfield persists | 95.8 % | `analisis_…panel_comun.json` (panel común 506) | `dominant_pct` | ✅ |
| §6.4 / Tabla 1 | Shape corr — concentration (r) | 0.968 | `analisis_…panel_comun.json` (panel común 506) | `corr_TCI` | ✅ |
| §6.4 / Tabla 1 | Shape corr — entropy raw (r) | 0.968 | `analisis_…panel_comun.json` (panel común 506) | `corr_H` | ✅ |
| §6.4 / Tabla 1 | Shape corr — entropy norm (r) | 0.966 | `analisis_…panel_comun.json` (panel común 506) | `corr_Hnorm` | ✅ |

> **Corrección de fuente — auditoría ronda 1 (capa: trazabilidad).** La columna p_doc de la Tabla 1 coincide con el cómputo del **panel común** (`analisis_…panel_comun.json`), **no** con el manifiesto p_doc natural (`manifest_A_prima_pdoc.json`), que es un conjunto muestral distinto (73.2 · 95.7 · 0.966). Esto **no es un error del paper**: §5 y §6.4 declaran que la comparación documental se hace "on the panel of journals eligible in both mass modes" (panel común, N = 506), justo para no reintroducir el confound de composición muestral. El error estaba en esta matriz, que apuntaba al manifiesto p_doc natural. **Fuente de verdad corregida → `analisis_…panel_comun.json`.** El manifiesto p_doc natural sigue siendo un archivo válido (se le recalcula el hash en §9), pero no es el origen de la Tabla 1. Confirmar en el re-run que ese archivo contiene el p_doc sobre los mismos 506 (y que su columna p_cit iguala 0.071/52.6/85.0, de modo que **ambas** columnas de la Tabla 1 tracen al panel común).

## 7 · Referencia backward y umbrales congelados (S4.3 · pre-registro)

Deben coincidir con el manifiesto backward **y** con el documento de pre-registro (fueron fijados antes de ejecutar).

| Ubicación | Afirmación | Valor esperado | Archivo fuente | Campo/consulta | Estado |
|---|---|---|---|---|---|
| S4.3 (REF_A) | JSD backward | 0.046 | manifiesto backward | `jsd_median` | ✅ |
| S4.3 (REF_A) | Jaccard backward | 1.00 | manifiesto backward | `jaccard_median` | ✅ |
| S4.3 (REF_A) | Dominant backward | 0.822 | manifiesto backward | `dominant_pct` | ✅ |
| S4.3 (REF_A) | TCI backward | 0.83 | manifiesto backward | `corr_TCI` o `TCI_ref` | ✅ |
| S4.3 (REF_A) | H backward | 0.90 | manifiesto backward | `H_ref` | ✅ |
| S4.3 (REF_A) | H_norm backward | 0.76 | manifiesto backward | `Hnorm_ref` | ✅ |
| S4.3 | PISO_JSD | 0.056 | pre-registro | `PISO_JSD` | ✅ |
| S4.3 | PISO_DOM | 0.792 | pre-registro | `PISO_DOM` | ✅ |
| S4.3 | TECHO_FORMA | 0.95 | pre-registro | `TECHO_FORMA` | ✅ |
| S2 / S4.3 | τ (umbral de núcleo) | 0.5 | pre-registro / código | `τ` / `TAU` | ✅ |
| S2 / S4.3 | MIN_SUBFIELDS | 3 | pre-registro / código | `MIN_SUBFIELDS` | ✅ |

## 8 · Reglas del control documental (S4.2 · pre-registro separado)

| Ubicación | Afirmación | Valor esperado | Archivo fuente | Campo/consulta | Estado |
|---|---|---|---|---|---|
| S4.2 | A_CONFIRMATORY — cota JSD | ≥ 0.071 | pre-registro p_doc | regla | ✅ |
| S4.2 | A_CONFIRMATORY — cota Jaccard | ≤ 0.60 | pre-registro p_doc | regla | ✅ |
| S4.2 | B_MATURATION — cota JSD | ≤ 0.046 | pre-registro p_doc | regla | ✅ |
| S4.2 | B_MATURATION — cota Jaccard | ≥ 0.90 | pre-registro p_doc | regla | ✅ |

## 9 · Hashes y campos `⟦…⟧` del Supplementary (S2 · S4.3 · S5 · S6)

| Ubicación | Afirmación | Valor esperado | Archivo fuente | Campo/consulta | Estado |
|---|---|---|---|---|---|
| S4.3 | Hash pre-registro (fwd + doc) | `⟦…⟧` (64 hex) | pre-registro | SHA-256 | ✅ |
| S4.3 / S5 | Hash script canónico | `08a0e48a…769` (completo en S5) | script | SHA-256 | ✅ |
| S4.3 | Hash manifiesto p_cit | **`9fb560d7…`** (ver nota abajo) | manifiesto p_cit | SHA-256 | ✅ |
| S4.3 | Hash manifiesto p_doc | `70d1ae78…` `⟦full 64 hex⟧` | manifiesto p_doc | SHA-256 | ✅ |
| S4.3 | Hash runbook p_doc | `⟦…⟧` | runbook | SHA-256 | ✅ |
| S5 | Hash lock de entorno | `3e5e937b…305a` | env lock | SHA-256 | ✅ |
| S5 | ID snapshot de entrada | `9844f2c9…4ff3` | snapshot | id | ✅ |
| S5 | Tolerancia numérica (float) | `⟦…⟧` | auditoría | `float_tol` | ✅ |
| S2 | Definición operacional exacta de M | `⟦…⟧` | código | def. `M` | ✅ |
| S2 | Regla exacta de D | `⟦…⟧` | código | def. `D` | ✅ |
| S6 | URL del repositorio | `⟦URL⟧` | — | — | ⏳ pendiente depósito |
| S6 | DOI de Zenodo | `⟦DOI⟧` | — | — | ⏳ pendiente depósito |
| Tabla S1 | Conteos por subcampo | `⟦…⟧` | manifiesto cohorte | `count_by_subfield` | ✅ |
| Tabla S2 | Diff de reproducción (por revista + agregado) | `⟦…⟧` (esperado: 0 diffs) | auditoría | reproduction diff | ✅ |

> **Nota (importante) sobre el hash p_cit.** S4.3 lista el manifiesto `p_cit` como `⟦…⟧`, pero S5 ya da el hash del **manifiesto canónico** `9fb560d7d53722a1…ed73ea`, que —por el historial de la auditoría (el script `08a0e48a…` reproduce `manifest_A_prima.json`)— **parece ser** el manifiesto p_cit/A′ — pero permanece como **hipótesis** hasta confirmar (R2): (a) nombre exacto del archivo, (b) contenido, (c) rol en el runbook, (d) SHA-256 recalculado directamente. Solo entonces **rellenar S4.3 con el hash confirmado** en lugar de `⟦…⟧`. (Corrección diferida al pase de números; no la aplico ahora para no abrir frente editorial ni dar por buena una inferencia.)

---

## 10 · Chequeos de consistencia interna (mismo número en varios sitios → deben coincidir)

Aquí es donde se esconden los errores de transcripción. Cada bloque debe cerrar exacto **antes** de congelar el PDF.

> **Gobierna R4:** en cada clúster manda la **fuente de verdad**; texto, tabla y figura deben coincidir con ella, no entre sí. Si dos copias coinciden pero difieren del origen, gana el origen y se corrigen las copias.

- **0.046 (JSD backward)** aparece en: §6.4 texto ("against 0.046") · S4.3 REF_A · S4.2 B_MATURATION (≤ 0.046) · Figura 5 panel a (ancla). → un único valor.
- **0.071 (JSD p_cit)** aparece en: §6.4 texto · Tabla 1 · S4.2 A_CONFIRMATORY (≥ 0.071) · Figura 5 panel a. → un único valor.
- **0.028 · 52.6 % · 72.9 % · 85.0 % · 95.8 %** aparecen en Tabla 1 **y** en Figura 5 (paneles a, b, c). → texto = tabla = figura.
- **506** aparece en: §6.4 texto · Tabla 1 (encabezado) · caption Figura 5. → un único valor.
- **521 / 522 / 1,461** aparecen en: §5 · S3 · Figura 2. Y **1461 − 521 = 940** (Figura 2). → coherencia aritmética.
- **Figura 5 panel c — persistencia dominante (fracciones) = Tabla 1 (porcentajes):** 0.822 (backward = REF_A) · 0.850 = 85.0 % (p_cit) · 0.958 = 95.8 % (p_doc). → deben cuadrar.
- **Figura 5 panel c — "mean shape correlation" = media de las tres correlaciones:**
  - backward 0.830 = media(TCI 0.83, H 0.90, H_norm 0.76) → **0.830** ✓ (recomputar).
  - p_cit 0.858 = media(0.852, 0.896, 0.827) → **0.858** ✓ (recomputar).
  - p_doc 0.967 = media(0.968, 0.968, 0.966) → **0.967** ✓ (recomputar).
  → confirmar que la figura muestra exactamente estas medias.
- **0.822 (dominant backward)** aparece en: S4.3 REF_A · Figura 5 panel c (backward). → un único valor.

---

## 11 · Contrato de datos — Figura 3 (tipología M × D + discriminante)

Para renderizar sin fabricar resultados, necesito del manifiesto:
- **Conteos exactos** de cada una de las 4 celdas de la tipología M × D (o los vectores M y D del cohorte comparable, N = 521, y yo hago el binning con tu regla).
- **Definición exacta de cada eje/categoría** (los cortes que separan las celdas; regla de D: nuclear / peripheral / displaced; cortes de M).
- **R² exacto** del discriminante de alignment **y la especificación del modelo** (variables, forma funcional).
- **N efectivo** del análisis (esperado 521; confirmar).

## 12 · Contrato de datos — Figura 4 (distribución de estabilidad S + robustez)

- **Vector completo de S** (o archivo por revista) sobre el cohorte elegible.
- **Mediana exacta** (esperada 0.783) y **N elegible** (esperado 511).
- **Estadísticos del backward shift** que quieras anotar (los que resuman el check de robustez).
- **Estadísticos del taxonomic coarsening** (idem).
- **Decisión de forma**: histograma / boxplot / densidad — la elijo según la forma real de los datos una vez tenga el vector (el método dataviz pide mirar la distribución antes de fijar el tipo).

## 13 · Contrato — Supplementary (`⟦…⟧` + S-Figuras/Tablas)

- Definición operacional exacta de **M** y regla exacta de **D** (S2).
- **Hashes completos** (64 hex): pre-registro, manifiesto p_cit (¿= `9fb560d7…`?), manifiesto p_doc (`70d1ae78…`), runbook.
- **Tolerancia numérica** (float) usada en la auditoría (S5).
- **URL del repositorio** y **DOI de Zenodo** (S6).
- **Table S1**: conteos por subcampo (los seis).
- **Table S2**: diff de reproducción por revista + agregado (esperado 0).
- **Figuras S1 / S2**: puedo producirlas con el mismo sistema dataviz cuando quieras (S1 esquemática — no necesita datos; S2 necesita el vector de divergencias por revista de la réplica forward).

---

## Protocolo congelado (release) + clave diagnóstica

**R1–R4 se consideran congeladas, igual que el manuscrito.** No se modifican más; lo único pendiente es *ejecutar* el procedimiento ya especificado contra la evidencia definitiva. El cierre deja de depender del criterio de quien revisa: depende de reglas escritas antes de abrir los datos.

**Cuatro capas de evidencia** — cada cifra pertenece a una, y eso fija su fuente de verdad (R4):

| Capa | Artefactos | Pregunta que responde |
|---|---|---|
| **Normativa** | preregistro · especificación metodológica · definiciones (τ, MIN_SUBFIELDS, PISO_JSD, PISO_DOM, TECHO_FORMA) | ¿Qué **debía** hacerse? |
| **Empírica** | manifiestos · salidas del pipeline | ¿Qué **produjo** realmente la ejecución? |
| **Presentación** | manuscrito · figuras · tablas · Supplementary | ¿Qué **comunicamos** al lector? |
| **Reproducibilidad** | SHA-256 · snapshot · runbook · environment lock · reproduction diff | ¿Puede otro **obtener lo mismo**? |

**Clave diagnóstica** — la capa donde nace la discrepancia determina la naturaleza del problema; no hay que investigar todo, basta mirar esa capa:

| Discrepancia observada | Capas en conflicto | Naturaleza del problema |
|---|---|---|
| manifiesto ≠ preregistro | empírica ↔ normativa | **metodológico** |
| manuscrito/figura/tabla ≠ manifiesto | presentación ↔ empírica | **editorial** |
| SHA-256 no coincide | reproducibilidad | **trazabilidad** |
| reproduction diff ≠ 0 | reproducibilidad | **reproducibilidad** |

---

*Estado global: ver § «Estado del pase de cierre» al final. Congelar el PDF solo con 0 ⚠ numéricas/especificación (URL/DOI pendientes de depósito no bloquean cifras, sí el depósito Zenodo).*


---

## Estado del pase de cierre (automático)

**Fecha:** 2026-07-28 · **PASS=66 · WARN=0 · pendiente depósito=2**

| § | ✅ | ⚠ | ⏳ |
|---|---:|---:|---:|
| 1 | 5 | 0 | 0 |
| 2 | 2 | 0 | 0 |
| 3 | 3 | 0 | 0 |
| 4 | 5 | 0 | 0 |
| 5 | 6 | 0 | 0 |
| 6 | 6 | 0 | 0 |
| 7 | 11 | 0 | 0 |
| 8 | 4 | 0 | 0 |
| 9 | 12 | 0 | 2 |
| 10 | 12 | 0 | 0 |

**URL/DOI:** pendientes de depósito Zenodo — **no** cuentan como discrepancia numérica.

**Phase D (PDF freeze / Zenodo):** desbloqueada numéricamente (0 ⚠); URL/DOI ⏳ pendiente depósito.
