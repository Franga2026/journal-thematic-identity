# Acta de congelamiento — Prueba C′: descomposición geométrica del movimiento de cuartiles
**Estudio:** Prueba C′ (análisis de mecanismo / descomposición). Enmienda **pre-ejecución** de la Prueba C.
**Supersede a:** Prueba C (SHA `572a9320…d0f2d`, commit `d4b901c`), marcada `superseded before execution`.
**Único cambio respecto de C:** realización **bootstrap no paramétrico** de las celdas cruzadas del Shapley (§4.2). C1, C3, hipótesis (H-C1…H-C4), estimandos, umbrales y semilla **sin cambios**.
**NO** modifica el veredicto de A (NO CONFIRMA, H0), **NO** completa ni sustituye B.
**Autor:** Francisco Javier Garrido Valdés (RosFlo Limitada)
**Fecha de congelamiento:** 2026-08-04
---
## Documento congelado
- Archivo: `docs/paper2/preregistro_pruebaCprima_descomposicion_geometrica.md`
- **SHA-256 (del `.md` comiteado, huella autoritativa):**
  `a6e937aa4378ce0dfe1314a48eb817807e56479ba4b36483e921ceab1c879dcc`
  *(obtener con `sha256sum docs/paper2/preregistro_pruebaCprima_descomposicion_geometrica.md`; ignorar hashes de copias de nube).*
- Huella replicada en: (a) esta acta, (b) la cabecera del script de análisis de C′ (que se escribe DESPUÉS de congelar).
## Enmienda (única): realización bootstrap de las celdas cruzadas
- V₀₁ = E[V(X*_E, |X_C|)], X*_E ~ F̂_E (pool ASJC efectivo); V₁₀ = E[V(X*_C, |X_E|)], X*_C ~ F̂_C (pool de contenido).
- Bootstrap **con reemplazo** de la distribución empírica de CiteScore del pool κ, al tamaño γ. Duplicados = pesos bootstrap, **no** revistas nuevas.
- **Focal fija una vez:** X*_{j,m} = {j} ∪ Bootstrap_{m−1}(pool \ {j}); se remuestrean los m−1 competidores.
- Elegibilidad = la de A; **sin tamaño mínimo nuevo**; no identificable solo si el pool generador es vacío (tamaño 1). Se **elimina** la restricción "objetivo > pool" (defecto de C).
- `rank_to_quartile` y desempate **idénticos a A**.
## Parámetros congelados (§6/§7 — heredados de C, sin cambio)
- α = 0,05 (unilateral) · R_C = 200 inicial → 1.000 si MCSE de φ_κ/F, φ_γ/F o I_κγ/F > 0,005 · B_boot = 2000 · semilla = 20260731 · τ = 0,50.
- Barra a-priori H-C2 = 0,20; criterio: **límite inferior bootstrap 95% > 0,20**.
- Tolerancia de aditividad Shapley: 1e-6. φ_κ = ½[(V₁₀−V₀₀)+(V₁₁−V₀₁)]; φ_γ = ½[(V₀₁−V₀₀)+(V₁₁−V₁₀)]; I_κγ = V₁₁−V₁₀−V₀₁+V₀₀.
- Categoría editorial efectiva (desambiguación de C, sin cambio): mínimo cuartil recomputado; empate ⇒ código ASJC menor; ese pool en las cuatro celdas.
- Stayer/mover temático: misma regla `in_category` de A (dom ∈ asjc_set).
## Datos (heredados de A — ya cargados y verificados)
- Universo = 25.920 revistas emparejadas del `run_manifest_universe_A.json`.
- `journal_identity_profile` (p_cit, config `W0_2021_2024`), CiteScore 2025, snapshot OpenAlex 2026-06-25.
- [ ] Check único: la corrida de C′ usa exactamente esos artefactos (hashes en el manifiesto de C′).
## Estatus
- Análisis de mecanismo; **no altera A ni B**; sin veredicto compuesto; H-C1…H-C4 con veredictos separados.
- El script de C′ se escribe DESPUÉS de esta acta y reproduce el preregistro renglón a renglón; emite `run_manifest_universe_C.json` (SHA del script, SHA de C′, snapshot, hashes de entradas, parámetros, resultados C1/C2/C3).
- **Fronteras, subcampos y ejemplos se inspeccionan únicamente DESPUÉS de congelar C′.**
---
*Firma (autor): Francisco Javier Garrido Valdés   ·   Fecha: 2026-08-04*
