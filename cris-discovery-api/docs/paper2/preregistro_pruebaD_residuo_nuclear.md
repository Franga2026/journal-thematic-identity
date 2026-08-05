# Preregistro — Prueba D: discriminación del residuo nuclear

**Estado:** **CONGELADO — 2026-08-03.** §7 fijado (mismos umbrales que Estudio 1). Checks de disponibilidad §2/§5 verificados en `cris_victoria` antes de esta huella. La SHA-256 de esta versión se registra en el acta de congelamiento.

**Estudio:** nuevo, independiente del manuscrito enviado a QSS (QSS-2026-0145). No modifica ni reinterpreta ese artículo; su veredicto "inconcluso" sobre el residuo nuclear se mantiene tal como fue reportado. Este preregistro diseña el experimento discriminante que aquel artículo **especificó y difirió** (§7–§8).

**Fecha de redacción:** 2026-07-31 · **Autor:** Francisco Javier Garrido Valdés (RosFlo Limitada)

---

## 1. Contexto y pregunta

Bajo ponderación documental (p_doc), la réplica prospectiva devolvió divergencia de masa muy baja (mediana 0,028, por debajo del ancla estable 0,046) pero **el núcleo no se preservó por completo**: Jaccard ≥ 0,90 en el **72,9 %** de las revistas del panel común, no en la casi totalidad. El manuscrito reportó ese residuo como **genuinamente ambiguo** entre dos explicaciones y se abstuvo de resolverlo post hoc:

- **H0 (artefacto de umbral).** La rotación del núcleo es el ruido esperable del operador de umbral duro τ = 0,5: subcampos que rozan la frontera acumulada del 50 % entran o salen del núcleo ante cambios de masa demasiado pequeños para mover la divergencia. Bajo H0 no hay reorganización temática documental real; solo discreción del operador más ruido de muestreo finito.

- **H1 (reorganización documental real).** Existe un cambio temático documental genuino, pequeño, concentrado cerca de la frontera del núcleo, que produce rotación por encima de la que el umbral generaría por sí solo.

Ambas producen la *misma* firma en el Jaccard agregado; no son separables con los estadísticos ya reportados. Esta prueba las separa con dos instrumentos preespecificados: un **modelo nulo** de magnitud y un **análisis de direccionalidad**.

## 2. Datos y cohorte

- **Fuente:** tabla `journal_identity_profile` en `cris_victoria` (columnas `source_id`, `subfield_id`, `p_doc`, `config`). Ejecución local (DSN a localhost), como el resto de la tubería.
- **Ventanas (config-tags):** las DOS ventanas del control documental de §6.4 — la base (`W0`) y la prospectiva (`W1`), ponderadas por **documentos** (p_doc). Deben ser exactamente las usadas en el manuscrito; se registran en el manifiesto de la corrida, no se codifican a mano en la interpretación.
- **Panel común (heredado):** intersección de `source_id` presentes en ambas ventanas con distribución p_doc válida y **≥ 3 subcampos** en cada una (regla `MIN_SUBFIELDS` idéntica a las Pruebas A/C). El tamaño (~506) es una propiedad de la corrida, no un valor fijado.
- **Requisito adicional para el modelo nulo — CONTEOS.** El modelo nulo necesita, por revista y por ventana, los **conteos de documentos por subcampo** (o al menos el total N_docs por ventana y las proporciones). Si la tabla de perfil solo guarda proporciones, se extraen los conteos de la tabla de obras/asignaciones que alimenta el perfil. *Confirmar disponibilidad antes de congelar.*

## 3. Operadores (heredados, idénticos — NO se re-sintonizan)

- **Núcleo:** conjunto de subcampos acumulados en orden decreciente de masa hasta que la masa acumulada alcanza por primera vez **τ = 0,50**, incluido el subcampo que cruza el umbral. Desempate estable `(−masa, subfield_id)`.
- **Rotación por revista:** `turnover = 1 − Jaccard(núcleo(W0), núcleo(W1))`.
- Idénticos a los de las Pruebas A/C por construcción; esta prueba **no** introduce operadores nuevos ni umbrales nuevos sobre el núcleo.

## 4. Hipótesis formales

- **H0:** la distribución de `turnover` observada en el panel es indistinguible de la que produciría, sobre las mismas revistas y los mismos N de documentos, un proceso en el que ambas ventanas provienen de una **misma** distribución subyacente (sin cambio real), sometida al operador de núcleo τ = 0,5. Además, los subcampos que entran/salen son **idiosincráticos** (dispersos entre revistas, sin dirección sistemática).
- **H1:** la `turnover` observada **excede** la del modelo nulo (componente real de magnitud) **y** la entrada/salida de subcampos es **sistemática** (concentrada en pocos subcampos y/o con deriva neta direccional) por encima del nulo.

## 5. Modelo nulo (fijado)

Para cada revista *j* del panel común, con conteos de documentos por subcampo en las dos ventanas y totales N0ⱼ, N1ⱼ:

1. Estimar la distribución subyacente común **p̂ⱼ** agrupando (sumando) los conteos de documentos de las dos ventanas y renormalizando. Bajo H0 esta es la "verdad" compartida por ambas ventanas.
2. Simular B veces: extraer `c0* ~ Multinomial(N0ⱼ, p̂ⱼ)` y `c1* ~ Multinomial(N1ⱼ, p̂ⱼ)`; formar p_doc* de cada ventana; computar núcleos y `turnover*`.
3. Esto genera, por revista, la distribución nula de rotación atribuible **solo** a muestreo finito + discreción del umbral, calibrada a "una distribución de masa tan estable como la observada" (ambas ventanas comparten p̂ⱼ, así que no hay cambio real).

**Estadístico agregado de magnitud.** Recomputar en cada una de las B réplicas el estadístico de panel elegido (§6) para obtener su distribución nula. `B = 2000` (fijo).

**Guarda de calibración (no es umbral sintonizable).** Verificar que la divergencia de masa sintética media del nulo sea del orden de la observada (≈0,028); si el nulo fuera mucho más estable que lo observado, se reporta y se documenta, sin mover umbrales.

**Robustez del nulo (preespecificada).** Repetir con un nulo **Dirichlet-multinomial** (sobredispersión moderada, concentración estimada por revista) como chequeo declarado de antemano; conclusión primaria sobre el nulo multinomial.

## 6. Estadísticos (fijados)

**Magnitud (primario).**

- `F_obs` = fracción de revistas con Jaccard < 0,90 (complemento directo del 72,9 % reportado).
- `T_obs` = media por revista de `turnover` (1 − Jaccard).
- Ambos se comparan contra su distribución nula (§5). p-valor unilateral `p = P(estadístico_nulo ≥ observado)`. Tamaño de efecto = exceso `observado − E[nulo]` y su IC por percentiles del nulo.

**Direccionalidad (primario).** Sobre las revistas con cambio de núcleo, registrar eventos ENTRA/SALE por subcampo:

- **Concentración/sistematicidad:** entropía normalizada (o Gini) de la distribución de flips por subcampo; H1 predice concentración **mayor** que el nulo (pocos subcampos concentran los flips).
- **Deriva neta:** por subcampo, (entradas − salidas); prueba de signo/binomial por subcampo contra 0. H1 predice al menos un subcampo con deriva neta significativa más allá del nulo.
- Ambos estadísticos se comparan contra la **misma** medida computada en el modelo nulo (que produce flips idiosincráticos por construcción), no contra una referencia externa.

## 7. Regla de decisión — TRES CELDAS, veredictos SEPARADOS, sin índice compuesto

*(Estilo heredado de las Pruebas A/B/C. Valores FIJADOS aquí, idénticos a Estudio 1; no se re-sintonizan tras ejecutar.)*

- α = **0,05** (unilateral) · B = **2000** · umbral Jaccard = **0,90** (heredado) · τ = **0,50** (heredado).
- Banda de equivalencia de magnitud: "dentro del nulo" ≡ `observado ≤ percentil 95 del nulo`.

Veredicto:

- **ARTEFACTO (H0 retenida):** magnitud dentro del nulo (`p ≥ α`) **Y** direccionalidad dentro del nulo (concentración y deriva no exceden el nulo). → El residuo es atribuible a la discreción del umbral; la identidad temática documental es estable, y el 72,9 % subestima la estabilidad "real" por artefacto del operador.
- **REORGANIZACIÓN REAL (H1):** magnitud excede el nulo (`p < α`) **Y** direccionalidad sistemática por encima del nulo. → Hay un componente documental genuino de reorganización cerca de la frontera del núcleo; nombrar los subcampos con deriva neta.
- **MIXTO / INCONCLUSO:** los dos instrumentos **discrepan** (p. ej. exceso de magnitud pero flips idiosincráticos, o dirección sistemática pero magnitud dentro del nulo). → Se reporta como tal, sin forzar. (Coherente con el manejo honesto del "inconcluso" en el manuscrito.)

## 8. Robustez preespecificada

- Sensibilidad de τ: repetir con τ ∈ {0,48, 0,50, 0,52} (reportado como diagnóstico, no como re-sintonización; el primario es τ=0,50).
- Umbral de Jaccard alternativo (0,95) para `F`.
- Nivel taxonómico: repetir con subcampo→campo (coarsening) como en la Prueba de robustez taxonómica.
- Nulo alternativo Dirichlet-multinomial (§5).

## 9. Qué contaría como confirmación / refutación / inconcluso

- **Confirmación de H0 (artefacto):** magnitud dentro del nulo y direccionalidad idiosincrática, estable bajo la robustez de §8.
- **Confirmación de H1 (real):** exceso de magnitud y direccionalidad sistemática, con subcampos nombrados y persistencia bajo §8.
- **Inconcluso:** discrepancia entre instrumentos o inestabilidad bajo robustez. Se reporta sin reinterpretar.

## 10. Procedencia y congelamiento

- Al congelar: SHA-256 de este archivo; los config-tags de ventana quedan registrados; α, bandas, B y umbrales **no se tocan** tras ejecutar.
- Estudio separado de QSS-2026-0145; llevará su propia versión (p. ej. companion / v1.1) y su propio depósito cuando corresponda.
- El script de análisis (Prueba D) se escribirá **después** de congelar este preregistro y reproducirá renglón a renglón esta especificación.

---

*Prueba D · discriminación del residuo nuclear · preregistro CONGELADO 2026-08-03.*
