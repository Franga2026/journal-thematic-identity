# Acta de congelamiento — Prueba C: descomposición geométrica del movimiento de cuartiles
> **SUPERSEDED BEFORE EXECUTION (2026-08-04).** La Prueba C (SHA `572a9320…d0f2d`, commit `d4b901c`) fue **reemplazada antes de cualquier ejecución** por la **Prueba C′** (`preregistro_pruebaCprima_descomposicion_geometrica.md`). Motivo: las celdas cruzadas del §4.2 eran **no identificables** cuando N_E ≠ N_C. Único cambio en C′: **realización bootstrap** de las celdas cruzadas. C1, C3, hipótesis, estimandos y umbrales sin cambios. Esta acta y su `.md` se preservan **sin modificar** como registro histórico; la Prueba C **nunca fue ejecutada**.
**Estudio:** Prueba C (análisis de mecanismo / descomposición). Independiente de QSS-2026-0145.
**NO** modifica el veredicto de la Comparación A (universo: NO CONFIRMA, H0), **NO** completa ni sustituye la Comparación B, **NO** es un test confirmatorio de la reclasificación.
**Autor:** Francisco Javier Garrido Valdés (RosFlo Limitada)
**Fecha de congelamiento:** 2026-08-04
---
## Documento congelado
- Archivo: `docs/paper2/preregistro_pruebaC_descomposicion_geometrica.md`
- **SHA-256 (del `.md` comiteado, huella autoritativa):**
  `572a932051cb6957e218b30396ffee09ece50389d762a7726081e033597d0f2d`
  *(obtener con `sha256sum docs/paper2/preregistro_pruebaC_descomposicion_geometrica.md`; ignorar hashes de copias de nube).*
- Huella replicada en: (a) esta acta, (b) la cabecera del script de análisis de C (que se escribe DESPUÉS de congelar).
## Parámetros congelados (§6/§7 — NO se re-sintonizan tras ejecutar)
- α = 0,05 (unilateral) · R_C = 200 inicial · B_boot = 2000 · semilla = 20260731 · τ = 0,50 (heredado).
- Barra a-priori H-C2 = 0,20; criterio: **límite inferior bootstrap 95% > 0,20**.
- Regla Monte Carlo: extender a R_C = 1.000 si MCSE de cualquier estimando principal de C2 (φ_κ/F, φ_γ/F, I_κγ/F) > 0,005.
- Tolerancia de aditividad Shapley: 1e-6 (identidad exacta).
- Remuestreo de celdas cruzadas: **sin reemplazo**; objetivo > pool o grupo < 4 ⇒ **no identificable** (contado, sin duplicados); cómputo por sorteo, luego promedio.
- Diseño 2×2: φ_κ = ½[(V₁₀−V₀₀)+(V₁₁−V₀₁)]; φ_γ = ½[(V₀₁−V₀₀)+(V₁₁−V₁₀)]; I_κγ = V₁₁−V₁₀−V₀₁+V₀₀ (salida separada obligatoria).
- Stayer/mover temático: **misma regla `in_category` de A** (dom ∈ asjc_set); ortogonal al quartile change.
## Desambiguación operacional (previa a la ejecución; NO cambia hipótesis ni spec)
Categoría editorial **efectiva** para revistas multi-categoría (fija el estado E y el pool ASJC de V₀₀/V₀₁ en las cuatro celdas):
> For journals assigned to multiple ASJC categories, the effective editorial category is the category yielding the **minimum recomputed editorial quartile**. Ties are resolved deterministically using the **ascending ASJC category identifier** (smaller code).
Procedimiento (con el operador sellado `rank_to_quartile`, NO usando el cuartil de contenido):
1. calcular el cuartil de la revista dentro de **cada** categoría ASJC elegible (población del frame con ese código, ≥4 revistas);
2. elegir el **mínimo**;
3. empate ⇒ **código ASJC menor**;
4. usar esa categoría como **pool editorial efectivo** en las cuatro celdas.
Registrada como desambiguación operacional previa a la ejecución, no como cambio de hipótesis ni ajuste posterior.
## Datos (heredados de A — ya cargados y verificados)
- Universo = 25.920 revistas emparejadas del `run_manifest_universe_A.json`.
- `journal_identity_profile` (p_cit, config `W0_2021_2024`), CiteScore 2025, snapshot OpenAlex **2026-06-25**.
- [ ] Check único: la corrida de C usa exactamente esos artefactos (hashes de A en el manifiesto de C).
## Estatus (recordatorio)
- Análisis de mecanismo; **no altera A ni B**; sin veredicto compuesto; H-C1…H-C4 con veredictos separados.
- El script de C se escribe DESPUÉS de esta acta y reproduce el preregistro renglón a renglón; emite `run_manifest_universe_C.json` (SHA del script, SHA de este preregistro, snapshot, hashes de entradas, parámetros, resultados C1/C2/C3).
- **Fronteras, subcampos y ejemplos se inspeccionan únicamente DESPUÉS de congelar.**
---
*Firma (autor): Francisco Javier Garrido Valdés   ·   Fecha: 2026-08-04*
