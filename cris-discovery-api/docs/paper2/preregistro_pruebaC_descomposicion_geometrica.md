# Preregistro — Prueba C: descomposición geométrica del movimiento de cuartiles bajo reclasificación temática
**Estado:** **CONGELADO — 2026-08-04.** Diseño factorial 2×2, Shapley simétrico, H-C2=0,20, α=0,05, B_boot=2000, semilla 20260731, τ=0,50 CONFIRMADOS; salvaguardas de remuestreo, identificabilidad, interacción I_κγ y precisión Monte Carlo incorporadas. La SHA-256 de esta versión se registra en el acta de congelamiento. *Redactado SIN mirar los datos (ningún subcampo de ejemplo, ninguna frontera).*
**Estudio:** análisis de mecanismo. Independiente de QSS-2026-0145. **NO** modifica el veredicto de la Comparación A (universo: NO CONFIRMA, H0), **NO** completa ni sustituye la Comparación B, **NO** es un nuevo test confirmatorio de la reclasificación. **Descompone un movimiento ya observado** (F = 37,8% del run canónico A).
**Fecha de redacción:** 2026-08-04 · **Autor:** Francisco Javier Garrido Valdés (RosFlo Limitada)
---
## 1. Contexto y pregunta
El run canónico A sobre el universo (N = 25.920 revistas) arrojó F = 37,8% de revistas que cambian ≥1 cuartil al reclasificar por contenido, **dentro del nulo de re-agrupamiento** (media 39,5%, P95 39,8%). Corrección técnica que ancla esta prueba: **el nulo de A ya reconstruye grupos, recomputa percentiles y desplaza fronteras en cada una de sus 2.000 permutaciones** (re-rankea con `rank_to_quartile` dentro de cada grupo permutado, de tamaños iguales a los subcampos de contenido). Por tanto, **que las fronteras se mueven ya está demostrado y cuantificado**: es la línea base (~40%). Lo que el nulo de A varía es la *composición* a *tamaños fijos*; lo que **no aísla** es (a) cuánto del 37,8% proviene de la geometría/tamaño de las poblaciones de contenido frente a las categorías ASJC, y (b) sobre **quién recae** el movimiento (revistas reclasificadas vs. revistas que permanecen).
**Pregunta principal.** ¿Cómo se distribuye el movimiento de cuartiles producido por la reconstrucción del espacio competitivo, y qué proporción afecta a revistas reclasificadas frente a revistas que permanecen en su categoría?
C **no** re-testea si los umbrales se mueven (ya incorporado en la línea base de A). C **explica cómo se genera el 37,8% observado y sobre quién recae.**
## 2. Datos y cohorte (heredados de A, sin re-emparejar)
- **Universo:** las **25.920** revistas emparejadas Scopus∩OpenAlex por ISSN del run canónico A (80,8% de las 32.089 de CiteScore 2025), tal como quedaron en `run_manifest_universe_A.json`.
- **Perfiles de contenido:** `journal_identity_profile`, `p_cit`, config **`W0_2021_2024`** (ventana 2021–2024, alineada a CiteScore 2025).
- **Métrica:** CiteScore 2025 (valor por revista, constante entre categorías).
- **Snapshot OpenAlex:** **2026-06-25** (registrado en el manifiesto de la corrida).
- **Categoría editorial de la revista:** códigos ASJC de 4 dígitos de CiteScore (Sub-subject Area). El código de subcampo OpenAlex es 1:1 con el código ASJC, por lo que **subcampo-de-contenido y categoría-editorial viven en el mismo espacio de códigos** — condición necesaria para C1.
## 3. Operadores (heredados, idénticos — NO se re-sintonizan)
- **Núcleo / subcampo-de-contenido dominante:** `nucleo(dist, τ=0,50)[0]`, desempate `(−p_cit, subfield_id)`. Idéntico a A.
- **Cuartil dentro de un grupo:** `rank_to_quartile` (el mismo operador sellado de A), aplicado a las CiteScore de la población que define cada estado.
- **`MIN_SUBFIELDS = 3`** para perfil válido. Idéntico a A.
- C **no** introduce operadores nuevos sobre el núcleo ni umbrales nuevos sobre el cuartil.
## 4. Estados, estimandos y definiciones
### 4.1 Estados (poblaciones de comparación de una revista j)
- **E — editorial:** j rankeada dentro de su **categoría ASJC** (membresía ASJC, tamaños ASJC). `q_E(j) = rank_to_quartile` dentro de la categoría. (El cuartil oficial de Scopus se registra como validación externa; el estimando usa el recomputado con el operador sellado para consistencia entre estados.)
- **C — contenido completo:** j rankeada dentro de su **subcampo-de-contenido dominante** (membresía de contenido, tamaños de contenido). `q_C(j)` = `quartile_content` de A.
### 4.2 Factores y 2×2 (formalización del Shapley simétrico)
El paso E → C combina **dos factores** que se togglean por separado:
- **COMPOSICIÓN (κ):** el *pool* de competidores — miembros de la categoría ASJC (κ=E) vs. miembros del subcampo-de-contenido (κ=C).
- **TAMAÑO/GEOMETRÍA (γ):** el *tamaño* del grupo de comparación — nₐₛⱼ𝚌(j) (γ=E) vs. n_contenido(j) (γ=C).
Las **cuatro esquinas** (subíndice = (κ, γ); 0 = editorial, 1 = contenido). El valor Vₖ es el estado de cuartil de j bajo esa población de comparación:
| Esquina | Composición κ | Geometría γ | Realización |
|---|---|---|---|
| **V₀₀** | editorial | editorial | = E (categoría ASJC real de j) |
| **V₁₀** | contenido | editorial | pool de **contenido** de j, re-dimensionado a nₐₛⱼ𝚌(j) |
| **V₀₁** | editorial | contenido | pool **ASJC** de j, re-dimensionado a n_contenido(j) |
| **V₁₁** | contenido | contenido | = C (subcampo de contenido real de j) |
**Regla de remuestreo de las celdas cruzadas (V₁₀, V₀₁) — CONGELADA:**
1. **Pool:** V₁₀ extrae del pool de contenido de j; V₀₁ del pool ASJC de j (el mismo pool que define κ en esa celda).
2. **Sin reemplazo, siempre.** Ninguna revista aparece más de una vez en una población contrafactual.
3. **Objetivo menor que el pool:** submuestreo sin reemplazo al tamaño objetivo.
4. **Objetivo mayor que el pool:** la celda se marca **NO IDENTIFICABLE** para ese subcampo/revista y se **excluye** del estimando afectado (se cuenta y reporta). **No** se introducen duplicados por muestreo con reemplazo (alteraría artificialmente la geometría del ranking).
5. **Grupos demasiado pequeños:** si una población de comparación queda con **< 4** revistas (no puede poblar 4 cuartiles), la celda es **NO IDENTIFICABLE** (contada y reportada).
6. **Preservación de CiteScore:** el muestreo sin reemplazo hereda la distribución de CiteScore del pool; no se estratifica ni re-pondera.
7. **Orden de cómputo:** el estimando se calcula **por sorteo** y luego se promedia sobre los R_C sorteos (no se combinan los sorteos antes de calcular).
### 4.3 Movers y stayers temáticos (por IDENTIDAD, no por cuartil)
Definidos por **identidad temática**, con **exactamente la misma regla de pertenencia que A** (operador `in_category` de A: `dom ∈ asjc_set`, coincidencia con **cualquiera** de las categorías ASJC de la revista; no se crea una regla nueva para C):
- **Mover temático:** subcampo-de-contenido dominante **∉** conjunto de códigos ASJC de la revista.
- **Stayer temático:** subcampo-de-contenido dominante **∈** conjunto de códigos ASJC de la revista.
Ortogonal a esto está el **cambio de cuartil** (quartile mover = `q_E ≠ q_C`). Una revista puede ser **simultáneamente stayer temático y quartile mover**: no cambió de identidad, pero cambió de cuartil porque su población de contenido incluye inmigrantes y excluye emigrantes. **Ese cruce es precisamente el fenómeno que C3 aísla.**
### 4.4 Correspondencia de fronteras (para C1)
Para cada **código de subcampo s** (4 dígitos), su población editorial = revistas cuya categoría ASJC contiene s; su población de contenido = revistas cuyo subcampo dominante es s. Las fronteras se comparan **dentro del mismo código s**.
## 5. Bloques confirmatorios (estimandos y salidas OBLIGATORIAS)
### C1 — Desplazamiento de fronteras
Para cada subcampo s y cada corte k ∈ {Q1|Q2, Q2|Q3, Q3|Q4}, registrar el valor de CiteScore que define la frontera en la población editorial (T^editorial_{s,k}) y en la de contenido (T^content_{s,k}):
**ΔT_{s,k} = T^content_{s,k} − T^editorial_{s,k}**
Salidas obligatorias: por corte y agregado — **mediana, IQR, P90** de ΔT (absoluto) y del cambio relativo ΔT/T^editorial; y la relación entre |ΔT_{s,k}| y el **cambio de membresía** del subcampo (entradas, salidas, cambio neto de tamaño).
### C2 — Descomposición del movimiento (Shapley simétrico)
Sobre el indicador por revista `V = [q ≠ q_{V₀₀}]` (cambio de cuartil respecto de la línea base E), las **contribuciones Shapley** (promediadas sobre los dos órdenes) son:
**φ_κ = ½·[(V₁₀ − V₀₀) + (V₁₁ − V₀₁)]**  (composición)
**φ_γ = ½·[(V₀₁ − V₀₀) + (V₁₁ − V₁₀)]**  (tamaño/geometría)
**Comprobación obligatoria de aditividad exacta:** por construcción `φ_κ + φ_γ = V₁₁ − V₀₀`. Es una **identidad algebraica** (los términos cruzados se cancelan), de modo que se verifica a **tolerancia numérica 1e-6**; cualquier violación por encima de esa tolerancia señala un **bug de implementación**, no un efecto.
**Interacción — salida obligatoria SEPARADA** (Shapley la reparte simétricamente entre φ_κ y φ_γ, pero **no la elimina**):
**I_κγ = V₁₁ − V₁₀ − V₀₁ + V₀₀**
Reportar I_κγ **globalmente, por subcampo, y con su distribución bootstrap**. Dice si composición y tamaño actúan casi aditivamente (I_κγ ≈ 0) o si su combinación produce un efecto propio.
Las celdas cruzadas (V₁₀, V₀₁) se promedian sobre **R_C** sorteos (§4.2, semilla fija). Salidas obligatorias: φ_κ, φ_γ, I_κγ como **fracción de F**, con IC por bootstrap (B_boot), y el recuento de celdas **no identificables** por subcampo.
**Regla de precisión Monte Carlo (preregistrada, no post hoc):** R_C = 200 como ejecución inicial; **cómputo obligatorio del error estándar Monte Carlo (MCSE)** de **todos los estimandos principales de C2** — las proporciones agregadas φ_κ/F, φ_γ/F **e I_κγ/F** — estimado como sd entre sorteos / √R_C. **Si el MCSE de cualquiera de ellos supera 0,005, extender automáticamente a R_C = 1.000** y reportar ambas corridas.
### C3 — Efecto sobre las revistas que permanecen (stayers)
En stayers temáticos, medir: **% que cambia de cuartil** (E→C); **dirección** (asciende/desciende); **distancia previa a la frontera** (en E); **desplazamiento de la frontera de su categoría** (ΔT del código de la revista); **balance ascensos/descensos**. Reportar los mismos descriptivos en movers para contraste.
## 6. Hipótesis preregistradas (direccionales; sin umbrales derivados de datos)
- **H-C1:** mayor cambio neto de membresía del subcampo ⇒ mayor desplazamiento absoluto de frontera. Test: **Spearman** ρ(|Δ membresía_s|, |ΔT_{s,k}|) > 0, unilateral, α = 0,05.
- **H-C2:** **Al menos el 20% de las revistas que cambian de cuartil bajo la reconstrucción completa del espacio competitivo son *thematic stayers*** (revistas cuya categoría temática NO cambia). Estimando: **P(thematic stayer | quartile change)**. Barra a-priori de importancia sustantiva = **0,20** (justificación: 5% sería demasiado débil; 50% sería una mayoría y una exigencia excesiva; 20% = al menos una de cada cinco transiciones de cuartil ocurre sin reclasificación temática individual). **Criterio inferencial:** H-C2 se considera **apoyada** si el **límite inferior del intervalo bootstrap del 95% (B_boot=2000) supera 0,20**. Si el estimando puntual supera 0,20 pero el límite inferior no, se reporta como **compatible pero no confirmatorio**.
- **H-C3:** la probabilidad de cambio de cuartil **aumenta cuanto menor era la distancia inicial a una frontera**. Test: logística `cambió_{E→C} ~ distancia_inicial_a_frontera + controles`, coeficiente de la distancia < 0, unilateral, α = 0,05.
- **H-C4 (hipótesis de MECANISMO, no reinterpretación de A):** la contribución **geométrica (γ) ≥** la contribución **temática (κ)** en la descomposición C2, con IC por bootstrap. Coherente con A (composición ≈ nula), pero se **prueba**, no se asume.
## 7. Regla de decisión — por hipótesis, SIN índice compuesto
*(Estilo heredado de A/B/D. Valores FIJADOS aquí; no se re-sintonizan tras ejecutar.)*
- α = **0,05** (unilateral) · **R_C = 200** inicial (celdas cruzadas) · **B_boot = 2000** (bootstrap de IC) · semilla = **20260731** · τ = **0,50** (heredado).
- **Regla de precisión Monte Carlo:** extender a **R_C = 1.000** si el MCSE de cualquier estimando principal de C2 (φ_κ/F, φ_γ/F, I_κγ/F) supera **0,005** (§C2).
- **Tolerancia de aditividad Shapley:** **1e-6** (identidad exacta; violación = bug).
- **Barra a-priori de H-C2 = 0,20** (confirmada), criterio: **límite inferior bootstrap 95% > 0,20**.
- Identificabilidad de celdas cruzadas: **sin reemplazo**; objetivo > pool o grupo < 4 ⇒ **no identificable** (contado y reportado), nunca duplicados (§4.2).
Cada hipótesis (H-C1…H-C4) recibe su **veredicto separado** (soportada / no soportada / inconcluso por inestabilidad en §8). **No hay veredicto compuesto** y **C no emite CONFIRMA/NO CONFIRMA de la reclasificación**: C es descomposición de mecanismo. **El veredicto de A (NO CONFIRMA, H0) permanece intacto y no puede ser alterado por C.** C tampoco reabre B.
**Resultado que C podría sostener (redacción a-priori, no garantizada):** "La reclasificación temática altera el espacio competitivo de dos maneras —reasigna algunas revistas a nuevas poblaciones y desplaza las fronteras de las que permanecen— pero la magnitud agregada del movimiento sigue dominada por la geometría general del re-agrupamiento, no por una señal temática adicional." Esto **explica** el 37,8%, no lo rescata.
## 8. Robustez preespecificada
- Sensibilidad de τ ∈ {0,48, 0,50, 0,52} (diagnóstico; primario τ=0,50).
- C1 con corte alternativo de relativo vs absoluto; C2 estable ante R_C ∈ {200, 400}; C3 con distancia en percentiles vs en unidades de CiteScore/IQR.
- Nivel taxonómico: repetir con subcampo→campo (coarsening).
- Reporte explícito de la interacción de C2 (si domina, se declara inconcluso el reparto γ/κ y se reporta como tal).
## 9. Procedencia y congelamiento
- Al congelar: **SHA-256** de este `.md` en disco (huella autoritativa, se ignoran copias de nube). α, barras, R_C, B_boot, semilla y umbrales **no se tocan** tras ejecutar.
- El script de C se escribe **después** de congelar y reproduce renglón a renglón esta especificación; emitirá `run_manifest_universe_C.json` con SHA del script, SHA de este preregistro, snapshot, hashes de entradas, parámetros y resultados de C1/C2/C3.
- Estudio de mecanismo independiente; no altera A ni B. **Los ejemplos de subcampos se muestran solo DESPUÉS de ejecutar.**
---
*Prueba C · descomposición geométrica del movimiento de cuartiles · preregistro CONGELADO 2026-08-04. Fronteras, subcampos y ejemplos se inspeccionan únicamente DESPUÉS de congelar.*
