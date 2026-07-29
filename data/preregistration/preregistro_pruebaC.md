# Pre-registro — Prueba C (perturbación de snapshot)

### Tercera perturbación independiente. Predicción fijada ANTES de acceder al segundo snapshot.

> **Estatus: CONGELADO (2026-07-22).** Este documento fija predicciones, métricas, umbrales y reglas de veredicto **antes** de observar los resultados del segundo snapshot. Conforme a la disciplina de A y B, los umbrales **no** se reinterpretan tras ver los datos. La predicción que aquí se congela es la que la *cláusula de estabilidad* del marco (`teorema_marco.md`, Parte II) estableció: bajo una tercera perturbación independiente, los componentes estructurales de `R_j` deben reproducir y los de forma deben ser menos invariantes, **igual que en A y B**.

---

## 0. Qué prueba C y por qué su mecanismo es distinto de A y B

- **Prueba A** perturbó la **ventana temporal** (W0 2021–2024 vs W-1 2020–2023): cambian **los documentos** que componen el perfil.
- **Prueba B** perturbó el **nivel de agregación taxonómica** (subfield → field): cambia la **resolución** de la taxonomía.
- **Prueba C** perturba el **snapshot de la fuente**: **misma ventana, misma taxonomía, mismas revistas y obras**; lo único que cambia es la **fecha de extracción** de OpenAlex. Entre snapshots, (i) maduran las citas (recuentos `C_{j,s}` mayores/menos sesgados) y (ii) una fracción de obras recibe **reasignación de `primary_topic`** al reprocesarse el corpus.

**Consecuencia decisiva para los umbrales.** El snapshot es la perturbación **de menor magnitud** de las tres: no altera qué se publicó ni la taxonomía, solo la lectura del mismo objeto en dos momentos de extracción. Por tanto la predicción correcta **no** es "reproduce como en A"; es **"reproduce al menos tan bien como en A"**. Esto convierte los valores observados en A en **pisos** (floors) de la predicción de C, no en umbrales heredados mecánicamente.

---

## 1. Condiciones de comparabilidad *(verificar ANTES de computar métricas; el script las chequea y aborta si fallan)*

Los dos snapshots deben coincidir en todo salvo la fecha de extracción:

1. **Cohorte común de revistas.** Se define como la **intersección** de `source_id` presentes en ambos snapshots con distribución válida (masa total > 0). Se reporta `N_S1`, `N_S2`, `N_común` y las exclusiones. El análisis corre **solo sobre la cohorte común**, fijada antes de mirar resultados.
2. **Misma ventana de publicaciones.** Ambos snapshots describen la **misma** ventana (p. ej. 2021–2024). Si la ventana está codificada en el `config`, debe ser idéntica salvo el sufijo de snapshot.
3. **Mismos identificadores** de revista (`source_id`) y de taxonomía; ninguna reconciliación de IDs entre snapshots.
4. **Misma taxonomía y nivel `subfield`** (mismo `subfield_id`, misma versión del árbol de tópicos).
5. **Mismo operador de núcleo**, τ = 0.50, masa acumulada, **misma regla de desempate** (orden estable por `(-p_cit, subfield_id)`), idéntica en ambos snapshots.
6. **Mismas reglas para casos límite**, fijadas aquí: (a) revistas sin masa suficiente = con < 3 subcampos o masa total ≤ 0 → **excluidas** y contadas; (b) citas faltantes = tratadas como 0 sobre el soporte unión; (c) empates en el dominante/núcleo = resueltos por el orden estable de (5), idéntico en ambos snapshots.

> Si cualquier condición 1–6 no se cumple, el script **se detiene** y reporta cuál falló. No se computa ninguna métrica sobre snapshots no comparables.

---

## 2. Métricas *(idénticas a A; veredictos SEPARADOS estructura / forma; sin índice compuesto)*

Para cada revista *j* de la cohorte común, con distribuciones `P1` (snapshot 1) y `P2` (snapshot 2) sobre el soporte unión de subcampos:

**Estructura** *(agregación por revista → se reporta distribución/mediana)*

- **JSD de masa:** `JSD(P1,P2)` (divergencia Jensen-Shannon, base 2, ∈ [0,1]). Referencia A = **0.046** (mediana).
- **Jaccard del núcleo:** `|K1 ∩ K2| / |K1 ∪ K2|`, con `K = núcleo(τ=0.5)`. Referencia A = **1.00** (top-K Jaccard).
- **Preservación del dominante:** `argmax(P1) == argmax(P2)` (regla de desempate estable). Referencia A = **0.822**.

**Forma** *(correlación entre revistas → se reporta r de Pearson y ρ de Spearman)*

- **TCI (HHI):** `corr( HHI(P1), HHI(P2) )`. Referencia A = **0.83**.
- **Entropía cruda:** `corr( H(P1), H(P2) )`. Referencia A = **0.90**.
- **Entropía normalizada:** `corr( H̃(P1), H̃(P2) )`, `H̃ = H/log k`. Referencia A = **0.76**.

---

## 3. Umbrales pre-registrados y su transferibilidad *(el núcleo del pre-registro)*

La **estructura del análisis** se hereda de A/B sin cambios (masa/núcleo vs forma; veredictos separados; sin índice compuesto). Los **umbrales** se justifican uno a uno, distinguiendo *heredado como piso*, *predicción direccional* y *banda de equivalencia*.

| Métrica | Tipo de umbral | Criterio pre-registrado | Justificación de transferibilidad |
|---|---|---|---|
| JSD masa | Piso + banda | mediana **≤ 0.056** (A 0.046 + banda 0.010) | Snapshot ⊂ temporal en magnitud: la masa no debe divergir **más** que en A. |
| Jaccard núcleo | Piso | mediana **= 1.00** y **% (J ≥ 0.90) ≥ 90 %** | El conjunto-núcleo fue idéntico en A bajo perturbación mayor; debe serlo aquí. |
| Dominante | Piso − banda | **≥ 0.79** (A 0.822 − banda 0.03) | Métrica "zona gris" en A; se exige al menos el nivel de A, con banda. |
| TCI (HHI) | Direccional + banda | **r ≥ 0.80** (A 0.83 − 0.03) **y** por debajo de la concordancia estructural | Forma: se predice ≥ A (perturbación más suave), pero **menos invariante que la estructura**. |
| Entropía cruda | Direccional + banda | **r ≥ 0.87** (A 0.90 − 0.03) **y** por debajo de la estructura | Ídem: no debe reproducir peor que en A. |
| Entropía normalizada | Direccional + banda | **r ≥ 0.73** (A 0.76 − 0.03) | Descriptor más frágil (fracasó en A); en C se predice ≥ A por ser perturbación más suave. **No** se le exige superar un umbral absoluto de "éxito": su rol es confirmar la **asimetría**, no pasar un corte. |

**Banda de equivalencia (declarada):** una métrica que caiga dentro de la banda indicada por debajo de su referencia A se considera **equivalente a A**, no un fracaso. Las bandas (0.010 en JSD; 0.03 en correlaciones y en dominante) se fijan aquí, antes de correr.

**Lo que NO se hereda:** no se traslada el veredicto binario "FRACASO de forma" de A/B como umbral absoluto de C. En C la forma se evalúa como **predicción direccional** (≥ A) y como parte de la **asimetría estructura > forma**, no contra un corte de éxito/fracaso importado.

---

## 4. Reglas de veredicto *(dos veredictos separados; se emiten antes de interpretar)*

**Veredicto estructural.**

- **ÉXITO** si se cumplen los tres pisos estructurales: JSD ≤ 0.056 **y** Jaccard mediana = 1.00 con %(J≥0.90) ≥ 90 % **y** dominante ≥ 0.79.
- **PARCIAL** si dos de tres se cumplen.
- **FRACASO** si ≤ uno.

**Veredicto de forma.**

- **CONSISTENTE CON LA PREDICCIÓN** si las tres correlaciones de forma cumplen su piso direccional (TCI ≥ 0.80, cruda ≥ 0.87, normalizada ≥ 0.73) **y** cada una queda por debajo de la concordancia estructural (asimetría estructura > forma).
- **DIVERGENTE** si alguna cae bajo su piso, o si la asimetría se invierte (forma ≥ estructura).

Se reportan **por separado**; **no** se combinan en un índice.

---

## 5. Vínculo con la hipótesis de estabilidad *(qué fortalece y qué debilita, fijado ahora)*

Del marco (`teorema_marco.md`, cláusula de falsabilidad):

- **FORTALECE** la hipótesis estructura/dinámica si: veredicto estructural = ÉXITO **y** la asimetría estructura > forma se mantiene (mismo patrón que A y B, ahora bajo un tercer mecanismo independiente). Tres perturbaciones que no comparten mecanismo → apoyo convergente genuino; recién entonces cabe **reconsiderar la elevación** de la hipótesis.
- **DEBILITA** el respaldo empírico (sin invalidar el núcleo deductivo del marco) si: la estructura **degrada por debajo de los pisos de A** bajo una perturbación **más suave** (resultado inesperado y en contra), **o** la asimetría se **invierte** (forma ≥ estructura).
- **NEUTRO / INFORMATIVO** si el veredicto estructural es PARCIAL: se reporta como en B, con la naturaleza del faltante diagnosticada (p. ej. cardinalidad del núcleo por no conmutatividad, si reaparece), sin mover umbrales.

En todos los casos, la redacción del manuscrito seguirá la regla del Apéndice C: ninguna afirmación más fuerte que su columna de estatus.

---

## 6. Salidas esperadas del script *(para que el resultado sea comparable renglón a renglón con §5.2)*

1. Bloque de **comparabilidad** (condiciones 1–6: N_S1, N_S2, N_común, exclusiones, checks OK/ABORTA).
2. **Estructura:** JSD (mediana, IQR, P90), Jaccard (mediana, %≥0.90), dominante (%). Cada una con su piso y PASS/FALLA.
3. **Forma:** TCI, entropía cruda, entropía normalizada — r de Pearson y ρ de Spearman, cada una con su piso direccional y PASS/FALLA, y marca de asimetría (¿< estructura?).
4. **Dos veredictos** (estructural, forma) según §4.
5. Línea de **vínculo con la hipótesis** según §5 (FORTALECE / DEBILITA / PARCIAL).

---

## 7. Estado de datos (no es resultado)

| Snapshot | Config prevista | Estado |
|---|---|---|
| S1 (referencia) | `W0_2021_2024` (= snap_A / extracción ya congelada) | **poblado** en `journal_identity_profile` |
| S2 (segundo snapshot) | `snap_B` / `W0_2021_2024_snapB` (misma ventana, fecha de extracción distinta) | **pendiente** — no acceder / no poblar hasta que este pre-registro esté archivado |

*Congelado 2026-07-22, antes de procesar el segundo snapshot. Cualquier desviación respecto de este documento se registrará como enmienda fechada, no como reinterpretación silenciosa.*

---

## Resultado congelado — Prueba C (2026-07-22)

**Materiales:** `manifiesto_snap2.yaml` · `logs/validar_S2.log` (gate=PASS) · `logs/populate_snap2.log` · `logs/pruebaC_snapshot.log`  
**S1:** `W0_2021_2024` · snapshot_date=2026-07-21 · N=522  
**S2:** `W0_2021_2024_snap2` · snapshot_date=2026-07-22 · N=522 · ok=522 fail=0  
**Comparabilidad:** n_común=522 · ≥3 subcampos ambos=521 · fechas distintas=PASS.  
Cohorte analítica del script (masa+≥3 subcampos): n=514 (7 excluidas por &lt;3 subcampos).

### Estructura (pisos pre-registrados)

| Métrica | Valor | Piso | |
|---|---:|---|---|
| JSD mediana | **0.000** | ≤0.056 | PASS |
| Jaccard mediana / %(≥0.90) | **1.000** / **99.2%** | =1.00 & ≥90% | PASS |
| Dominante | **99.6%** | ≥79.2% | PASS |

**Veredicto estructural: ÉXITO (3/3).**

### Forma (pisos direccionales + asimetría)

| Métrica | r | Piso | asimetría (&lt; estruct) |
|---|---:|---|---|
| TCI | 0.999 | ≥0.80 PASS | **NO** |
| H_cruda | 0.999 | ≥0.87 PASS | **NO** |
| H_norm | 0.998 | ≥0.73 PASS | **NO** |

**Veredicto de forma: DIVERGENTE** (pisos ok; asimetría estructura&gt;forma **no** — forma ≈ estructura en el techo).

### Vínculo con la hipótesis (§5, regla pre-registrada)

**DEBILITA** el respaldo empírico de la *asimetría* (sin invalidar el núcleo deductivo): la estructura reproduce (≥ A), pero bajo esta perturbación la forma también alcanza concordancia casi perfecta, así que la asimetría estructura&gt;forma **no** se observa.

**Hecho factual de la perturbación:** S1→S2 = 1 día de API OpenAlex viva (21→22 jul 2026). JSD mediana=0 implica lectura prácticamente idéntica del mismo objeto; la perturbación efectiva es **casi nula**. No se enmiendan umbrales. No se reinterpreta el veredicto automático.

