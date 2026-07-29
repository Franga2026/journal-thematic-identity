# Pre-registro — Recompute de estabilidad S sobre `p_doc`

### Corrige el sesgo por rezago de citación (S sobre citas → S sobre documentos). Congelado ANTES de correr.

> Motivo: la fórmula previa medía S sobre la distribución **por citas** por año, confundida por el rezago de citación (cohortes recientes aún no acumulan citas maduras → falsa inestabilidad). La corrección, ya identificada en §3.3 y Apéndice B, es medir S sobre la distribución **documental** `p_doc` por año. Este documento fija las decisiones antes de correr; no se reinterpretan tras ver los datos.

**Estatus: CONGELADO (2026-07-22), antes de correr el recompute.**

---

## Definición

Para la revista *j*, con distribución documental por subcampo y año `p_doc[s | y] = D_{j,s,y} / D_{j,y}`:

```
S_j = 1 − mean_{(y,y+1) válidos} JSD( p_doc[· | y], p_doc[· | y+1] )
```

`S ∈ [0,1]`; 1 = perfil documental idéntico año a año (máxima estabilidad); valores menores = más rotación temática interanual. **No** interviene ninguna distribución por citas.

---

## Decisiones congeladas *(las ocho, fijadas antes de correr)*

1. **Ventana anual exacta.** Años **2021, 2022, 2023, 2024** (la misma ventana W0). Pares adyacentes posibles: (2021,2022), (2022,2023), (2023,2024) → **máximo 3** por revista.
2. **Universo incluido.** El **universo analítico general** (perfil reconstruido; el mismo N sobre el que se define el perfil, §3). S es una propiedad de la Etapa 1 (reconstrucción). Se computa sobre ese universo y se **reporta el subconjunto analizable** (con ≥ 1 par adyacente válido); las bajas se cuentan con motivo.
3. **Mínimo de documentos por año (`D_MIN`).** Un año es **válido** para *j* si `D_{j,y} ≥ D_MIN`. **Primario: `D_MIN = 5`.** Justificación: por debajo de ~5 documentos, `p_doc` de un año es ruido de muestreo y no un perfil. Se reporta **sensibilidad** a `D_MIN ∈ {3, 5, 10}` (§ salida).
4. **Años sin documentos (o `< D_MIN`).** Se marcan **inválidos** y se **excluyen**. La adyacencia se evalúa **solo entre años calendario consecutivos ambos válidos**: si `y` es válido pero `y+1` no, ese par **no** contribuye (no se "salta" a un año no adyacente).
5. **Subcampos ausentes.** JSD sobre el **soporte unión** de subcampos de los dos años, rellenando con 0 los ausentes (mismo criterio que en la Prueba C).
6. **Base del log / convención de JSD.** Divergencia Jensen-Shannon en **base 2**, `∈ [0,1]` (idéntica a `pruebaC_snapshot.py`). `S = 1 − mean(JSD)`.
7. **Revistas con un solo año válido (o cero pares adyacentes).** `n_adjacent_pairs = 0` → **S indefinida** → `status = 'sin_pares_adyacentes'`; se excluyen de la distribución de S y se cuentan aparte. Incluye el caso de dos años válidos pero **no** adyacentes.
8. **Salida.** Tabla por revista + resumen agregado (abajo), con la sensibilidad a `D_MIN`.

---

## Salida esperada

**Por revista:**

```
journal_id · n_valid_years · n_adjacent_pairs · mean_jsd_doc · stability_S · status
```

`status ∈ { 'ok', 'sin_pares_adyacentes', 'sin_anios_validos' }`.

**Resumen agregado (para el manuscrito — NO reportar solo la media global):**

- **N analizable** (status = 'ok') y N excluido por motivo.
- **Mediana de S**, **IQR** (P25–P75), **P10** y **P90**.
- **Media de S** (secundaria, junto a la mediana).
- **Proporción de revistas excluidas** y su desglose por motivo.
- **Sensibilidad a `D_MIN`**: mediana de S, N analizable y % excluido a `D_MIN ∈ {3,5,10}` — para mostrar que la lectura no depende del umbral elegido.

---

## Reglas de reporte en el manuscrito (§3.3)

- Sustituir el marcador 【PENDIENTE】 por la **distribución** de S (mediana + IQR + P10/P90), no por una media aislada.
- Declarar `D_MIN` primario y la tabla de sensibilidad.
- Mantener la nota de Apéndice B (por qué documentos y no citas) como justificación del cambio.
- El N de S es **propio de este análisis** (revistas con ≥ 1 par adyacente válido) y se anota como tal en el diagrama de selección (subconjunto S), no como el N general.

---

## Estado de datos (no es resultado)

| Insumo | Estado |
|---|---|
| Universo W0 (`journal_identity_profile` / summary 2024) | poblado (~522) |
| Conteos anuales `D_{j,s,y}` para 2021–2024 | tabla `journal_yearly_doc` vía `scripts/recompute_S_pdoc.py --extract` |
| Script | `scripts/recompute_S_pdoc.py` |

*Congelado 2026-07-22, antes de correr el recompute. `D_MIN=5` primario; sensibilidad {3,5,10} pre-declarada.*

---

## Resultado congelado (2026-07-22)

Log: `logs/recompute_S_pdoc.log` · CSV: `data/stability_S_pdoc.csv` · tabla: `journal_yearly_doc` (27 570 filas, 522 revistas).  
Extract: ok=522 fail=0. Decisiones del pre-registro **sin enmienda**.

### Primario D_MIN = 5

| | |
|---|---|
| N analizable (status=ok) | **511** / 522 |
| Excluidas | 11 (2.1%) — todas `sin_pares_adyacentes` |
| **Mediana S** | **0.783** |
| IQR [P25, P75] | [0.713, 0.861] |
| P10 / P90 | 0.631 / 0.911 |
| Media S (secundaria) | 0.776 |

### Sensibilidad D_MIN (pre-declarada)

| D_MIN | N analizable | % excluido | Mediana S |
|---:|---:|---:|---:|
| 3 | 515 | 1.3% | 0.782 |
| **5** | **511** | **2.1%** | **0.783** |
| 10 | 498 | 4.6% | 0.787 |

La lectura **no depende** del umbral: mediana S ≈ 0.78–0.79 en {3,5,10}.

`journal_identity_summary.stability_s` actualizado para las 511 ok (window_year=2024).

### Pares adyacentes (D_MIN=5, N analizable=511)

| n_adjacent_pairs | n revistas |
|---:|---:|
| 1 | 9 |
| 2 | 10 |
| 3 (máximo) | **492** (96.3%) |

Casi todo el subconjunto S aporta los 3 pares posibles (2021–22, 2022–23, 2023–24).
