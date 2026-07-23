# Paquete de integración → v1.2-es-final · Rama 3 (DEBILITA)

**Qué es esto.** Bloques listos para aplicar sobre tu `docs/paper2/…v1.1-es-final.md` (canónico) y producir `v1.2-es-final.md`. No modifica v1.1: se crea versión nueva. Rellené los 【slots】 del playbook con los resultados de A′ (`manifest_A_prima.json` / `prueba_A_prima_2026-07-23.log`). §8 no cambia.

**Rama elegida por la rejilla congelada:** `¬estruct_ok ∧ ¬forma_techo → DEBILITA` (Rama 3). Elección mecánica, sin interpretación posterior.

**Métrica de masa:** confirmado por inspección de `scripts/prueba_A_prima.py` (líneas 69, 82) que la JSD de masa se computa sobre **`p_cit`** (distribución de tópicos ponderada por citas). Confirmado además (líneas 87–92, 152–154) que el **núcleo/Jaccard** se construye sobre la misma distribución `d` armada desde `p_cit` (`nucleo(dist)` con `dist = to_dists(…p_cit…)`). Esto se declara en §5.10 y condiciona la interpretación de §6.

---

## Nota atestada del ajuste de redacción *(va al CHANGELOG; se explica abajo)*

> **2026-07-23 — Ajuste de redacción de la Rama 3, sin cambio de veredicto ni de estatus.** El texto pre-escrito de la Rama 3 (playbook, 2026-07-22) suponía el mecanismo "estructura y forma se degradan de modo comparable". Los datos de A′ muestran un mecanismo distinto: **la forma se sostuvo respecto de A (TCI 0.83→0.852, H 0.90→0.896, H norm 0.76→0.827) y no se degradó**; el DEBILITA proviene **exclusivamente** del incumplimiento del criterio estructural. Se corrige la descripción del mecanismo para que sea fiel a lo observado. **El veredicto (DEBILITA) y el estatus resultante (evidencia mixta) no cambian**: `forma_techo=False` es una comparación contra un techo **absoluto** (0.95) —incumplido también por A—, no una comparación contra A. Fidelidad al pre-registro exige reportar el resultado, no repetir una redacción que los datos contradicen.

---

## BLOQUE 1 · Nueva sección §5.10 *(insertar después de §5.9; añadir punteros "ver §5.10" en §5.2 y §5.4)*

> ### 5.10 Réplica temporal prospectiva (Prueba A′)
>
> Réplica hacia adelante de la Prueba A (§5.2) sobre el **mismo eje temporal**: desplaza la ventana 2021–2024 → 2022–2025 (intercambia 2021↔2025, ~75 % de solape). Protocolo pre-registrado (`preregistro_pruebaA_prima.md`), umbrales heredados de A, sin cambios. 2025 no se inspeccionó para fijar umbrales, de modo que A′ es una réplica **fuera de la muestra** de desarrollo. Es réplica del eje de A, **no** un eje de perturbación independiente.
>
> **Panel.** Revistas elegibles (≥ subcampos mínimos) en ambas ventanas: presencia bruta N(2021–2024)=521, N(2022–2025)=514; **panel común = 506**, con **2 entradas** y **8 salidas** (cambios reales de elegibilidad, reportados por separado; el análisis corre sobre el panel común).
>
> **La perturbación fue real y con poder discriminante.** El **100 %** de las revistas del panel presenta JSD > 0; solo el **2.6 %** tiene JSD ≤ 0.01 (JSD mediana 0.071, media 0.091, IQR 0.083, P90 0.177, máx 0.644). A diferencia de C0 (§5.9), donde la perturbación fue nula, A′ desplazó efectivamente el contenido: prácticamente todas las revistas cambiaron, y el cambio no es atribuible a unas pocas revistas extremas. El diagnóstico de magnitud (Enmienda 1) cumple aquí su función pre-registrada: contextualiza el experimento **sin** intervenir en la clasificación.
>
> **Estructura (contra las referencias de A).** JSD de la distribución de masa **por citas** (`p_cit`): mediana **0.071** (A 0.046). Núcleo (Jaccard): mediana **1.000**, pero solo el **52.6 %** de las revistas alcanza Jaccard ≥ 0.90 (A ~100 %). Subcampo dominante: persiste en el **85.0 %** (A 82.2 %). **Forma:** TCI r = **0.852** (ρ 0.838; A 0.83), H cruda r = **0.896** (ρ 0.888; A 0.90), H norm r = **0.827** (ρ 0.814; A 0.76).
>
> **Veredicto y su trazabilidad.** La clasificación **DEBILITA** se produjo porque el criterio estructural pre-registrado no se satisfizo en **dos de sus tres condiciones**: la JSD mediana (0.071) superó el piso `PISO_JSD = 0.056`, y la fracción de revistas con Jaccard núcleo ≥ 0.90 (52.6 %) quedó por debajo del 90 % exigido; la tercera condición —persistencia del subcampo dominante, 85.0 % ≥ `PISO_DOM = 79.2 %`— **sí** se cumplió. En forma, la relación factual es `forma_min = 0.827 < TECHO_FORMA = 0.95`; por eso `forma_techo`, **definido** como el predicado `forma_min > TECHO_FORMA`, evalúa a `False` —condición **también incumplida por A**, cuya forma (0.76–0.90) tampoco alcanzaba 0.95—. La conjunción `estruct_ok = (Falso) ∧ (Falso) ∧ (Verdadero) = False`, junto con `forma_techo = False`, sitúa el resultado en la celda **DEBILITA** (y no CONTRADICE) de la rejilla congelada. La asignación es mecánica; no media interpretación posterior.
>
> **Lectura del mecanismo.** El resultado **no** es una degradación de la forma: los tres descriptores de forma se sostuvieron respecto de A o mejoraron levemente. El DEBILITA proviene **exclusivamente** del criterio estructural, y dentro de él, de la **microestructura**: el subcampo dominante se conserva (incluso algo mejor) y el volumen documental apenas varía (+2.46 %, diagnóstico anual), pero la composición interna del núcleo se reorganiza (Jaccard ≥ 0.90 cae a 52.6 %) y la masa se redistribuye (JSD 0.071). Es decir, la identidad temática conserva su **macroestructura** (disciplina dominante, volumen, correlaciones globales de forma) mientras modifica su **microestructura** (composición del núcleo, distribución de masa) bajo una perturbación temporal moderada. La asimetría "estructura > forma" observada en A no se reproduce en esta ventana, no porque la forma empeore, sino porque la estructura fina deja de ser la capa más estable. Sobre la interpretación de la magnitud —y la métrica `p_cit`—, ver §6. Se reporta íntegro conforme al pre-registro.

---

## BLOQUE 2 · Tabla A vs A′ *(dentro de §5.10; se reportan por separado, nunca combinadas en un índice)*

| Métrica | A (2020–2023 vs 2021–2024) | A′ (2021–2024 vs 2022–2025) |
|---|---|---|
| JSD masa `p_cit` (mediana) | 0.046 | **0.071** |
| Jaccard núcleo (mediana) | 1.00 | 1.000 |
| Jaccard núcleo (% ≥ 0.90) | ~100 % | **52.6 %** |
| Dominante (persistencia) | 82.2 % | **85.0 %** |
| TCI r (Pearson · Spearman) | 0.83 | 0.852 · 0.838 |
| H cruda r (Pearson · Spearman) | 0.90 | 0.896 · 0.888 |
| H norm r (Pearson · Spearman) | 0.76 | 0.827 · 0.814 |
| Panel común (N) | — | 506 (entradas 2 · salidas 8) |
| Perturbación (% JSD ≤ 0.01) | — | 2.6 % |

---

## BLOQUE 3 · §5.4 (síntesis) — reemplazo del párrafo de síntesis

> El patrón estructura > forma es claro y reproducible en la Prueba A y presente en el eje taxonómico (B); sin embargo, su réplica temporal prospectiva fuera de muestra (A′, §5.10) **no lo reproduce**: la evidencia entre réplicas temporales es **mixta**. La distinción estructura/dinámica queda, por tanto, como interpretación con **apoyo parcial y en tensión**, no consolidada. La tensión no proviene de una degradación de la forma —que se mantuvo estable en A′— sino de la **microestructura**: la composición interna del núcleo temático se reorganiza aun cuando el campo dominante y el volumen se conservan. Su lectura, además, está condicionada por la métrica de masa (`p_cit`), sensible a la maduración citacional de 2025 (ver §5.10 y §6).

---

## BLOQUE 4 · §6 (discusión) — párrafos a incorporar

> La réplica prospectiva A′ introduce una tensión que se reporta sin reinterpretar umbrales. En A, todas las capas estructurales (masa, núcleo, dominante) resultaron más estables que los descriptores de forma. En A′ esa asimetría no se reproduce: mientras el subcampo dominante (85.0 %), el volumen documental (+2.46 %) y las correlaciones de forma (r ≥ 0.83) se sostienen, la composición interna del núcleo se reorganiza (Jaccard ≥ 0.90 en solo 52.6 % de las revistas) y la masa se redistribuye (JSD mediana 0.071). El hallazgo sugiere que la estabilidad de la identidad temática puede operar en **al menos dos escalas**: una **macroestructura** —disciplina dominante, volumen, forma global— que se conserva, y una **microestructura** —redistribución entre subcampos, composición del núcleo— que puede modificarse bajo una perturbación temporal moderada. Esto abre una pregunta que el planteamiento original no pretendía responder: si la identidad temática de una revista es un objeto **jerárquico**, con componentes de estabilidad diferencial. La hipótesis es tentativa y requeriría réplicas adicionales; se registra como línea derivada, no como conclusión.
>
> **Precisión metodológica: la estructura de A′ se operacionaliza sobre citas (`p_cit`).** La estructura temática comparada en A′ fue operacionalizada mediante distribuciones de participación citacional por subcampo (`p_cit`); tanto la JSD de masa como el núcleo —y por tanto su Jaccard— derivan de esa misma distribución. En consecuencia, el incumplimiento estructural observado expresa una menor estabilidad de la **composición citacional interna** y no demuestra por sí solo una modificación equivalente de la distribución documental. Debido a la incorporación de 2025, una fracción del cambio podría estar asociada con la **menor maduración de las citas del año entrante**. Esta consideración limita la interpretación causal, pero **no altera la clasificación pre-registrada** de la réplica. Es, además, la misma fuente de sesgo que el marco ya reconoció al recomputar la estabilidad temporal S sobre `p_doc`. El diagnóstico anual **acota, pero no elimina**, la ambigüedad: confirma que el **corpus documental** es estable (volumen +2.46 %, subcampo dominante idéntico en 2021 y 2025), lo que descarta un cambio de régimen a nivel de **documentos**; pero, al medirse la masa sobre **citas**, no zanja si la redistribución en `p_cit` es dinámica temática genuina o inmadurez citacional de 2025. Con los datos actuales, ambas lecturas son compatibles.
>
> Otras explicaciones plausibles, ninguna de las cuales "salva" la hipótesis: un cambio de contenido real en 2022–2025; la sensibilidad diferencial de las métricas de composición del núcleo frente a las de forma; o que la estabilidad extrema de A fuese en parte específica de su ventana. En conjunto, el resultado se reporta como **DEBILITA** conforme a la rejilla congelada, con la interpretación apropiadamente atemperada: no es una refutación firme de la asimetría, sino evidencia mixta cuya lectura estructural depende de una métrica (`p_cit`) sensible a la maduración. Dos pruebas la dirimirían, ambas como **trabajo futuro** y **no** como ajuste post-hoc del resultado congelado: (i) una réplica temporal computada sobre `p_doc` —consistente con la corrección ya aplicada a S—, y (ii) el eje de maduración (C-meses), que re-mide la misma ventana tras la acumulación de citas.

---

## BLOQUE 5 · §7 (trabajo futuro) — añadir

> La réplica temporal A′ queda hecha. Pasan a prioridad: (a) una **réplica temporal sobre `p_doc`**, consistente con la corrección aplicada a la estabilidad S, para separar la reorganización microestructural real de la sensibilidad citacional de la métrica `p_cit` usada en A/A′; (b) el eje de **maduración de datos (C-meses)**, genuinamente distinto, que re-mide la ventana 2022–2025 tras la acumulación de citas; y (c) un análisis dirigido de **qué difiere en 2025** a nivel de composición de subcampos, junto con réplicas en ventanas de menor solape, para contrastar la hipótesis de **estabilidad jerárquica** (macro vs microestructura) surgida en §6.

---

## BLOQUE 6 · Apéndice C (claim → evidencia) — filas

| Afirmación | Estatus / evidencia |
|---|---|
| Distinción estructura/dinámica (asimetría estructura > forma) | **Hipótesis con evidencia mixta entre réplicas** (clara en A y presente en B; **no reproducida en A′**). Interpretación en tensión, no consolidada. |
| Réplica temporal prospectiva A′ (2022–2025) | **No reproduce la asimetría.** La estructura fina se afloja (JSD `p_cit` 0.071; Jaccard ≥0.90 en 52.6 %) mientras forma (r ≥ 0.83) y dominante (85.0 %) se conservan. Veredicto DEBILITA por criterio estructural; perturbación real (2.6 % JSD ≤ 0.01). Métrica de masa `p_cit`: lectura estructural atemperada por posible maduración citacional de 2025 (ver §6); dirimen réplica sobre `p_doc` y C-meses (futuro). |

---

## BLOQUE 7 · §8 (Conclusión) — SIN CAMBIOS

〖CONGELADO〗 No se toca. La contribución (marco, reconstrucción reproducible, separación observación/inferencia, tipología M/D) no depende de que la asimetría se confirme. A′ solo mueve el estatus de una hipótesis interpretativa, no el núcleo del aporte.

---

## BLOQUE 8 · Gobernanza *(CHANGELOG.md + VERSIONES.md)*

**Entrada CHANGELOG (v1.2-es-final):**

> **v1.2-es-final (2026-07-23).** Integra la Prueba A′ (réplica temporal prospectiva 2022–2025) como §5.10. Veredicto de la rejilla congelada: **DEBILITA** (`¬estruct_ok ∧ ¬forma_techo`). Estatus de la hipótesis estructura/dinámica degradado a **evidencia mixta entre réplicas**. Sin cambios de protocolo, umbrales ni rejilla. **Ajuste de redacción atestado** (ver nota 2026-07-23): la forma **no** se degradó respecto de A; el DEBILITA proviene solo del criterio estructural (microestructura). Se documenta que la métrica de masa es **`p_cit`** y que la lectura estructural queda atemperada por posible maduración citacional de 2025; réplica sobre `p_doc` y C-meses quedan como pruebas dirimentes futuras (§6, §7). §8 sin cambios. v1.1-es-final permanece inalterada. Hallazgo destacado: estabilidad macroestructural con reorganización microestructural (hipótesis de estabilidad jerárquica, §6, tentativa).

**Actualizar VERSIONES.md:**

- Añadir fila `v1.2-es-final | 2026-07-23 | 🔒 canónica en repo | ver repo | A′ integrada (§5.10), Rama 3 DEBILITA; SHA256 autoritativo en VERSIONES.md`.
- Estado del protocolo: `A′ — réplica temporal prospectiva` → **Ejecutada e integrada (DEBILITA)**; `C-meses` y **réplica temporal sobre `p_doc`** suben a prioridad.
- Registro de ejecuciones: añadir fila `2026-07-23 | A′ (W0 vs W+1, panel común 506) | DEBILITA; perturbación real (JSD p_cit med 0.071, 2.6% ≤0.01); forma estable, microestructura reorganizada | Integrado en v1.2 §5.10; estatus → evidencia mixta`.

---

## Congelamiento

1. Aplicar los Bloques 1–8 sobre una copia de `v1.1-es-final.md` → `v1.2-es-final.md`. **No** tocar v1.1.
2. `sha256sum docs/paper2/…v1.2-es-final.md` → registrar el hash **completo** en `VERSIONES.md` (canónico).
3. Commit con la entrada de CHANGELOG.
4. v1.2-es-final queda como fuente para traducir → v1.2-en.

*§6 quedó como texto único (métrica confirmada `p_cit`); ya no hay variante pendiente.*

---

## Aplicación en repo (2026-07-23)

- Archivo canónico v1.2: `docs/paper2/manuscrito_identidad_tematica_v1.2-es-final.md`
- SHA256: `7ab6a4366214e9056c0656f416c831a247bcdc64fd7dbc915485cc12cb984bcc`
- v1.1 SHA256 (inalterado): `9ef46d28e6f815ffe6dd78680bead44109b4db59ab64149341e76599c0e95d70`
- Paso 1 (núcleo/Jaccard): `nucleo(dist)` con `dist` desde `p_cit` — OK
