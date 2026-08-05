# Prueba D — Kit de reproducción y sello (residuo nuclear)

Discrimina, sobre el panel documental (`p_doc`, N=515 revistas), si el residuo del
núcleo entre ventanas es **artefacto de frontera del operador (H0)** o **reorganización
documental real (H1)**. Misma disciplina que C′: preregistro congelado con SHA-256,
operador sellado, reglas de tres celdas, sin mover umbrales tras ver datos.

## Veredicto

**ARTEFACTO (H0).** La magnitud observada (F = fracción con Jaccard(núcleo) < 0.90)
está **dentro** del nulo, y la direccionalidad está **dentro** del nulo. La identidad
temática documental permanece estable entre 2021–2024 y 2022–2025.

Redacción prudente (la que va al texto):
> Bajo el nulo preregistrado y sus controles de robustez, no se encuentra evidencia de
> reorganización documental real; el residuo observado es compatible con inestabilidad
> de frontera del operador de núcleo. La identidad temática documental permanece estable.

## Números canónicos

| cantidad | valor |
|---|---|
| panel común (≥3 subcampos ambas ventanas) | **515** |
| F_obs (Jaccard < 0.90) | **0.2660** |
| T_obs (turnover medio) | 0.1199 |
| jsd mediana observada | 0.0280 |
| nulo F media / P95 | 0.3680 / 0.3943 → **no excede** |
| nulo T P95 | 0.1924 → no excede |
| direccionalidad: ent_obs vs P5 | 0.8989 vs 0.8451 → no concentrada |
| direccionalidad: max\|net\| vs P95 | 7 vs 14 → no sistemática |
| calibración: jsd_obs vs jsd_nulo | 0.0280 vs 0.0620 (nulo sobre-dispersado; conservador) |
| robustez τ=0.48 / 0.52 | F=0.2796 / 0.3126 (mismo cuadrante) |
| robustez coarsening a campo | F=0.0194 (colapsa; el residuo es de subcampo, no de campo) |
| robustez nulo Dirichlet-mult F_p95 | 0.3864 → no excede |
| tests unitarios (T2–T5) | **PASS** |

## Insumo sellado (vía b)

El runner computa **directamente desde el CSV congelado**, no desde Postgres:
`D_panel_input_combined.csv` (SHA-256 `ca9dc894…`), exportado de `cris_victoria`
(`journal_identity_profile`, configs `W0_2021_2024` y `W+1_2022_2025`, columnas
`source_id, config, subfield_id, d, p_doc`; ver `D_input_export_manifest.json`).
Esto hace el kit auto-contenido y reproducible sin base de datos.

## Cómo reproducir

```bash
# desde el directorio del kit. Requiere numpy/pandas/scipy.
# Ajustar la ruta INPUT_CSV al inicio de estudio1_pruebaD.py si se mueve el CSV.
python3 estudio1_pruebaD.py
```

Produce: `canonical_D_observed.csv`, `canonical_D_null.npy` (cols F,T,Ent,MaxNet,JSD),
`canonical_D_directionality.csv`, `canonical_D_robustness.csv`,
`run_manifest_universe_D.json` (+ `.sha256`), y ejecuta los tests T2–T5.

### Test 1 — reproducción determinista (obligatorio)
Ejecutar dos veces. Exigir: estadísticas idénticas; los cuatro artefactos
**byte-idénticos**; mismo veredicto; manifiesto idéntico **salvo `run_iso_utc`**.
Verificado aquí además con **dos `PYTHONHASHSEED` distintos** (0 y 1): salida
byte-idéntica ⇒ sin dependencia del orden de hash (se corrigió el orden de conjuntos
en `jsd` y en las listas que alimentan `norm_entropy`).

### Tests 2–5 (en `tests_pruebaD.py`, corren dentro del runner y como script)
- **T2** construcción del nulo multinomial: p̂=(d0+d1)/(N0+N1); N desde `d`; réplicas suman a N.
- **T3** `nucleo_counts` ≡ `E.nucleo` (operador sellado) en fronteras, empates y 200 casos aleatorios.
- **T4** direccionalidad: flip, deriva neta con signo, entropía de concentración, max\|net\|.
- **T5** robustez: τ solo cambia el núcleo; coarsening usa `field_of`; Dirichlet preserva soporte.

## Hashes para el sello

| archivo | SHA-256 |
|---|---|
| `estudio1_cuartil_por_contenido.py` (operador sellado) | `a8157be9e97d85b957199a8e96e9a055b08dd6b2eadb276973584d543f3f2a94` |
| `estudio1_pruebaD.py` (runner) | `e2978661258cce4cf7fb493f96bb9de3fd1e565d3c4b10c3e7262c03f7995590` |
| `pruebaD_ops.py` | `2826e3f0727d96cadf3eeae35c6b959c19df282ed7f51619b7a4c571043c51f4` |
| `tests_pruebaD.py` | `7e6bd59ece52cdcb8f7d5f6cf99ad6edc4bf1c9cc9e0707cf3d2cf9773e913f8` |
| `D_panel_input_combined.csv` (insumo sellado) | `ca9dc8942f79844c2320af86161ea413062809b20915edcbb20b2fb2f4a59f66` |
| `preregistro_pruebaD_residuo_nuclear.md` (congelado) | `b7facbe3bc4ce70b8f958e76ec2dd003dbd955cd5c9d962ada8a7e8c5d09b30d` |
| `canonical_D_observed.csv` | `25bf0673f45b3257c3f0eb28ffa42339ab4337595eb784a1981bd2c82be9cc6d` |
| `canonical_D_null.npy` | `dd254dcaf84f41a95bf4f05da0066f023ca74d2a6cee30f4572e949e62da4089` |
| `canonical_D_directionality.csv` | `6ef89ac10d8c53974699bc7e3f0a589702e27b20b8a34803a78cf68e34d6591d` |
| `canonical_D_robustness.csv` | `fbf87092b77ca80224dc22d52dd3ebdff851b776ceda8083296f0e425ee9b265` |
| `run_manifest_universe_D.json` | `a867c4e5dafbdfd226cf12a4c8732cfab020eb545473e0cbda5a411109491ed4` |

## Instrucciones de sello (git)

1. `git_commit` queda **`null`** en el JSON (evita circularidad hash↔commit).
2. Copiar el kit al repo, verificar los hashes de arriba (`sha256sum -c` o manual).
3. Correr el runner una vez localmente y confirmar Test 1 (byte-idéntico salvo `run_iso_utc`).
4. `git add` + `git commit` de todo el kit **tú** (yo no hago commits).
5. Registrar el hash del commit en un **sidecar** (`run_manifest_universe_D.commit`), no dentro del JSON.
6. El SHA autoritativo del manifiesto es el del **archivo commiteado** en el repo
   (regla de fin de línea); `run_manifest_universe_D.json.sha256` = `a867c4e5…` sobre la copia de nube.

## Nota de calibración del nulo (reportada, sin mover umbrales)

El nulo multinomial trata las dos ventanas como muestreos independientes, pero
2021–2024 y 2022–2025 se **solapan** y provienen de un proceso estable; por eso su
divergencia sintética media (0.062) es **mayor** que la observada (0.028). Esto hace
la conclusión ARTEFACTO **conservadora** (lo observado queda por debajo de un piso de
ruido sobre-dispersado). Robustez a τ y coarsening a campo confirman ARTEFACTO con
independencia de la calibración del nulo.

## Alcance

Estudio independiente; **no modifica A/B/C′**. Se sella como bloque D separado.
