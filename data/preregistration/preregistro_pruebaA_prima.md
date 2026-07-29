# Pre-registro — Prueba A′ (réplica temporal prospectiva, ventana 2022–2025)
### Réplica hacia adelante de la Prueba A, NO una perturbación independiente. Congelado ANTES de mirar resultados.
> **Naturaleza (declarada).** A′ es una **réplica** de la Prueba A sobre el **mismo eje temporal** (desplazamiento de ventana de 4 años, ~75 % de solape), **no** un tercer eje independiente. A perturbó hacia atrás (2021–2024 vs 2020–2023, intercambia 2020↔2024); A′ perturba hacia adelante (2021–2024 vs 2022–2025, intercambia 2021↔2025). Ambas modifican el **conjunto documental** publicado. Su valor es la **generalización temporal**, no añadir un mecanismo nuevo.
>
> **Cláusula fuera-de-muestra.** A′ puede llamarse "prospectiva / out-of-sample" **solo porque los datos de 2025 no se inspeccionaron** para definir umbrales ni decisiones analíticas del marco. Este pre-registro fija umbrales e interpretación **antes** de construir/observar la ventana 2022–2025.
---
## 0. Ubicación en la arquitectura de perturbaciones
| Prueba | Perturba | Eje | Estado |
|---|---|---|---|
| **A** (2021–2024 vs 2020–2023) | conjunto documental (año atrás) | temporal | cerrada (§5.2) |
| **A′** (2021–2024 vs 2022–2025) | conjunto documental (año adelante) | **temporal (réplica de A)** | este pre-registro |
| **B** (subfield→field) | resolución taxonómica | taxonómico | cerrada (§5.3) |
| **C0** (snapshot 1 día) | ~nada (extracción idéntica) | reproducibilidad de pipeline | cerrada (§5.9) |
| **C-meses** (snapshot meses) | maduración de citas / actualización de la base | datos | futura |
A′ **no** se combina con A en un índice único: se reportan por separado y se comparan.
---
## 1. Diseño
- **Ventana 1:** 2021–2024 (`W0_2021_2024`, ya existe). **Ventana 2:** 2022–2025 (`W+1_2022_2025`, a poblar con el **mismo pipeline** de A, solo cambiando el rango de años).
- Solape de 3 años (2022–2024); entra 2025, sale 2021.
- **Umbrales e indicadores: idénticos a A.** No se define ninguno nuevo.
## 2. Panel de revistas y elegibilidad
- **Panel común:** revistas elegibles en **ambas** ventanas (intersección). El análisis principal corre sobre el panel común.
- **Entradas / salidas esperadas** (no son anomalía): revistas que aparecen solo en 2022–2025 (p. ej. nacidas en 2025) o solo en 2021–2024 (dejaron de publicar). Se **reportan por separado** (conteo de entradas, salidas, panel común) — a diferencia de C0, aquí el cambio de elegibilidad es información, no un fallo de comparabilidad.
## 3. Métricas *(idénticas a A; veredictos separados estructura / forma; sin índice compuesto)*
Sobre el panel común, por revista, con `P` = distribución por citas de cada ventana:
**Estructura** (agregación por revista → mediana/distribución)
- **JSD de masa** `JSD(P_2021-2024, P_2022-2025)` (base 2). Referencia A = **0.046**.
- **Jaccard del núcleo** (τ=0.5, desempate estable). Referencia A = **1.00**.
- **Preservación del dominante**. Referencia A = **0.822**.
**Forma** (correlación entre revistas → r Pearson, ρ Spearman)
- **TCI (HHI)** — ref. A **0.83** · **Entropía cruda** — ref. A **0.90** · **Entropía normalizada** — ref. A **0.76**.
## 4. Umbrales pre-registrados *(heredados de A, con banda de equivalencia)*
A diferencia de C (donde A era un **piso** por ser el snapshot más suave), A′ es el **mismo eje** que A → se espera **valores similares a A**, no mejores. "Estructura preservada" y "forma menos invariante" se evalúan contra las referencias de A con banda ±0.03 (correlaciones, dominante) y +0.010 (JSD):
- **Estructura preservada** si: JSD mediana ≤ 0.056 **y** Jaccard mediana = 1.00 (con % ≥ 0.90 alto) **y** dominante ≥ 0.79.
- **Forma en el techo** (señal de perturbación pequeña) si las tres correlaciones de forma > **0.95**.
- **Asimetría presente** si las correlaciones de forma quedan **por debajo** de la concordancia estructural **y** no están en el techo (hay perturbación de forma real).
## 5. Rejilla de interpretación *(congelada; el resultado se lee contra esto, sin reinterpretar)*
| Resultado observado | Lectura pre-registrada |
|---|---|
| Estructura preservada **y** asimetría presente (forma < estructura, forma no en techo) | **Reproduce la asimetría** → **fortalece la generalización temporal** de la hipótesis estructura/dinámica. |
| Estructura preservada **pero** forma también en el techo | **Perturbación pequeña** (2022–2025 apenas difiere de 2021–2024 en contenido) → **inconcluso** para discriminar, como C0. |
| Estructura **y** forma se degradan de modo similar | **Debilita** la hipótesis (la estructura no fue más estable que la forma). |
| Forma **más estable** que la estructura | **Contradice** la hipótesis para esta ventana. |
## 6. Redacción lista para §7 *(al integrar A′; no se aplica al manuscrito hasta ejecutar)*
> **Réplicas temporales y maduración de datos.** La Prueba C ejecutada sobre dos snapshots separados por un día confirmó la reproducibilidad operacional del pipeline, pero produjo una perturbación prácticamente nula y, por ello, escasa capacidad para discriminar entre componentes estructurales y descriptores de forma. Como extensión inmediata, se propone una réplica prospectiva de la Prueba A mediante el desplazamiento de la ventana 2021–2024 a 2022–2025 (Prueba A′). Esta réplica evalúa nuevamente la estabilidad de la representación frente al cambio del contenido publicado y pertenece al mismo eje temporal de A. Separadamente, snapshots distanciados por varios meses permitirán evaluar la robustez frente a la maduración y actualización de los datos, idealmente distinguiendo un panel documental fijo de una reextracción completa de la ventana.
## 7. Orden de ejecución
1. Poblar `W+1_2022_2025` con el mismo pipeline de A (solo cambia el rango de años). 2025 completo.
2. Correr `prueba_A_prima.py` sobre el panel común, **sin tocar umbrales**.
3. Leer el resultado contra la rejilla §5. Reportar A y A′ por separado.
4. Integrar en el manuscrito (§5.2 o §5.9-adyacente + §5.4 + §7 + Apéndice C) → **v1.2**.
*Congelado 2026-07-22, antes de construir la ventana 2022–2025. A′ es réplica del eje temporal, no perturbación independiente.*
---
# Enmienda 1 — Magnitud de perturbación, universo analítico y alcance de la rejilla
**Fecha:** 2026-07-22 · **Estado:** pre-ejecución (congelada antes de poblar/analizar `W+1_2022_2025`) · **Aplicación:** A′, `W0_2021_2024` vs `W+1_2022_2025`
## 1. Propósito
Precisa tres aspectos operativos de A′ antes de ejecutarla: (1) documentación de la **magnitud efectiva** de la perturbación temporal; (2) delimitación de las **variables que determinan la rejilla de cuatro**; (3) definición y reporte de la **composición del panel**.
**No modifica:** métricas · umbrales · reglas de decisión · taxonomía · definición de estructura o forma · ramas interpretativas pre-registradas. Añade **salidas obligatorias** y precisa el protocolo; no introduce una salida de rescate.
## 2. Magnitud efectiva de la perturbación
Las ventanas comparten 2022–2024 y difieren por el intercambio de 2021 por 2025 → A′ es una perturbación temporal **real pero parcialmente solapada**. Antes de interpretar la rejilla se calculará y documentará, **sobre el panel común**:
- proporción de revistas con `JSD > 0`;
- distribución de JSD: mínimo, máximo, media, mediana, IQR/rango, cuantiles relevantes;
- volumen total de documentos en 2021 y 2025; diferencia absoluta y relativa;
- cambios en los subcampos dominantes / de mayor peso entre 2021 y 2025;
- cuando proceda, proporción del perfil atribuible a los años intercambiados.
Es un **diagnóstico de intensidad**. **No forma parte de la rejilla ni modifica la clasificación pre-registrada.** Si el resultado cae en una rama inconclusa por efecto techo o escasa variación, la magnitud observada se usará **solo** para distinguir **descriptivamente**:
- ausencia de evidencia bajo una perturbación efectiva **limitada**; vs
- ausencia de la asimetría esperada **pese a** una perturbación sustantiva.
**Baranda dura (blindaje):** la magnitud de perturbación **no** se convierte en un nuevo umbral post hoc para aceptar o rechazar la hipótesis. No se reinterpretará una rama contradictoria como confirmatoria, ni se alterarán umbrales tras observar los datos. Una perturbación débil **limita la capacidad de prueba**; **no** constituye evidencia de refutación **ni** de confirmación.
## 3. Variables que determinan la rejilla de cuatro
La celda se decide **exclusivamente** por la relación entre **estructura** (JSD · Jaccard del núcleo · conservación/cambio del dominante · demás indicadores estructurales del pre-registro) y **forma** (correlación de TCI · H · `H_norm` · demás indicadores de forma).
**No** intervienen en la asignación de la celda: **JCA · M · D · tipología editorial-comparativa.** Sus cambios entre ventanas podrán analizarse como **resultados secundarios descriptivos**, claramente separados del veredicto de A′.
## 4. Composición del panel
Análisis principal sobre el **panel común** (elegibles en ambas ventanas). Se reportan por separado: N elegibles en `W0_2021_2024` · N elegibles en `W+1_2022_2025` · tamaño del panel común · **entradas** (solo 2022–2025) · **salidas** (solo 2021–2024) · causas identificables cuando existan. Entradas y salidas son **composición poblacional, no errores**; no se incorporan al panel común ni se imputan resultados entre ventanas.
## 5. Integración editorial
La salida de A′ entra en las secciones del playbook: **§5.10 · §5.4 · §6 · §7 · Apéndice C · mapa**. **§8 (Conclusión) permanece sin cambios** salvo contradicción lógica o factual independiente de la rama obtenida: A′ aporta evidencia sobre los resultados y su interpretación, no altera por sí sola la contribución conceptual de la conclusión.
## 6. Regla de congelamiento
Esta enmienda se incorpora al pre-registro **antes** de poblar/analizar `W+1_2022_2025`; recibe versión y fecha; registra su SHA256 completo; se anota en `VERSIONES.md`; y permanece **inalterada** durante la ejecución de A′.
*Enmienda 1 congelada 2026-07-22, pre-ejecución. Añade salidas obligatorias; no toca métricas, umbrales ni ramas.*
---
# Enmienda 2 — Alineación técnica (código ↔ pre-registro ↔ artefactos)
**Fecha:** 2026-07-22 · **Estado:** pre-ejecución (congelada antes de poblar/analizar `W+1_2022_2025`) · **Naturaleza:** alineación verificable; **no** modifica métricas ni umbrales (`REF_A`, `PISO_JSD`, `PISO_DOM`, `TECHO_FORMA` intactos) ni las cuatro lecturas interpretativas.
## 1. Operacionalización explícita de la rejilla *(punto metodológico — hecho explícito antes de ejecutar)*
La versión previa del script operacionalizaba "forma por debajo de la concordancia estructural" con un heurístico **implícito y no documentado**: `estruct_ref = min(dom_pct, jac_pct)` comparado contra `forma_min`. Ese heurístico **no** provenía de A (en A la lectura fue cualitativa) y comparaba una **correlación** (forma) contra una **fracción de revistas** (estructura) — magnitudes distintas. Se **reemplaza**, antes de observar resultados, por una operacionalización **apples-to-apples** basada en dos binarios anclados a las referencias de A:
- **`estruct_ok`** = la estructura de A′ cumple los pisos de A: `JSD mediana ≤ 0.056` **y** `Jaccard mediana = 1.00` (con `% ≥ 0.90` alto) **y** `dominante ≥ 0.792`.
- **`forma_techo`** = las tres correlaciones de forma (Pearson) `> 0.95`.
Las **cuatro celdas** (idénticas en lectura a §5) quedan:
| | forma ¬techo | forma techo |
|---|---|---|
| **estruct_ok** | REPRODUCE_ASIMETRIA → fortalece | INCONCLUSO (perturbación pequeña, como C0) |
| **¬estruct_ok** | DEBILITA | CONTRADICE (forma reproduce, estructura no) |
Esto **no** cambia umbrales ni las lecturas pre-registradas; hace **explícita y unívoca** la regla de asignación de celda, eliminando la comparación correlación-vs-fracción. Fijado **antes** de la ejecución.
## 2. Convención computacional de "JSD > 0"
"JSD > 0" (Enmienda 1) se implementa con tolerancia numérica: se considera cero `JSD ≤ 1e-9`. La salida reporta **ambas**: `JSD>0` exacto y `JSD>1e-9` (tolerancia). Es convención de cómputo, no un umbral de decisión.
## 3. Mecanismo del diagnóstico anual (2021 vs 2025)
Los diagnósticos de la Enmienda 1 §2 que requieren datos anuales (volumen 2021/2025, diferencia abs/rel, subcampos dominantes por año) los produce **el propio `prueba_A_prima.py`** consultando la tabla anual (`QUERY_YEARLY`) sobre el panel común, y se persisten en `manifest_A_prima.json`. **No** dependen de inspección manual del log.
## 4. Salidas, elegibilidad, determinismo y persistencia
- **Salidas comprometidas completas:** Pearson **y** Spearman de forma; IQR, P90, `%JSD≤0.01`; y el diagnóstico de rejilla (`estruct_ok`, `forma_min`, `forma_techo`).
- **Panel por elegibilidad:** `common/entradas/salidas` se derivan de conjuntos **elegibles** (`≥ MIN_SUBFIELDS`), no de presencia bruta; la presencia bruta se reporta aparte.
- **Determinismo:** el panel se ordena (`sorted`) → artefactos reproducibles.
- **Persistencia:** resultados por revista en `resultados_A_prima_por_revista.csv` (con `source_id`, dominantes por ventana) + `manifest_A_prima.json` con todos los diagnósticos.
- **DSN por entorno:** el script lee `DSN` de variable de entorno; sin credencial incrustada.
## 5. Regla de congelamiento
Enmienda 2 se incorpora **antes** de poblar/analizar `W+1_2022_2025`; recibe fecha; el paquete A′ (pre-registro + script) se **re-hashea** y ese SHA256 pasa a ser el autoritativo final; se anota en `VERSIONES.md`; permanece inalterada durante la ejecución.
*Enmienda 2 congelada 2026-07-22, pre-ejecución. Alinea código, pre-registro y artefactos; no cambia métricas, umbrales ni las cuatro lecturas.*
