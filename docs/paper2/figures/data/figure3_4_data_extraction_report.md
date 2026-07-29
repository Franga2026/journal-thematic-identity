# figure3_4_data_extraction_report.md

**Fecha (UTC):** 2026-07-28T14:25:08.438706+00:00  
**Modo:** solo lectura y exportación. Manuscrito / Supplementary / matriz / scripts / resultados **no modificados**.  
**Directorio de salida:** `docs/paper2/figures/data/`

---

## Artefactos y SHA-256

| Archivo | SHA-256 |
|---|---|
| `docs/paper2/figures/data/figure3_data.json` | `430a86345405ad776246d70d02a3c93bc6991f41e3f1208fa530922b6612b0e4` |
| `docs/paper2/figures/data/figure4_stability.csv` | `a25322815ebabe97e852909174f420893087d7b9ccd11946e416c0c804791113` |
| `docs/paper2/figures/data/figure4_robustness.json` | `c5621b1f94046f5644c82837bba5a6b3a7e2c2619ba538b86de946a2387ada6d` |

---

## A · Figura 3

### Tipología M×D
- **Fuente:** `cris-discovery-api/data/md_intrinsecos_W0.csv` (SHA `fd489fcda3cdfc89b4ba790ac4c19b88487c3d47042a7638ba26d3c1b26f4f20`)
- **Especificación congelada de ejes/agrupación:** `docs/paper2/spec_MD_cientifica.md` §Matriz 2×2 (M≥0.50; D-cerca=núcleo; D-lejos=periferia∪desplazada) — **DISPONIBLE**, no inventada
- **N:** 521
- **Celdas (fila×columna → count):**
  - M-alta × D-cerca → **415** (M≥0.50 ∧ núcleo)
  - M-alta × D-lejos → **0** (M≥0.50 ∧ periferia∪desplazada)
  - M-baja × D-cerca → **70** (M<0.50 ∧ núcleo)
  - M-baja × D-lejos → **36** (M<0.50 ∧ periferia∪desplazada)
- **sum(cells) = 521**
- **D_cat crudas:** {'núcleo': 485, 'periferia': 33, 'desplazada': 3}
- **mean_dominant_share:** 0.474507471264368 (N=522; `avg(max(p_cit))` W0) → ≈0.475

### Discriminante
- **Comando:** `load_data(2024)` + OLS N=521 excl. JOES (`chequeo_jca_joes` / `validez_discriminante_jca`)
- **H:** r2_raw = 0.394809361560552 → 3dec **0.395** · 2dec **0.39**
- **TCI:** r2_raw = 0.495676061260238 → 3dec **0.496** · 2dec **0.5**
- **Campo `r2_published` en JSON:** 3-decimal scientific (V1.2 §5.5 body): 0.395 / 0.496

---

## B · Figura 4

### Estabilidad
- **Fuente:** `cris-discovery-api/data/stability_S_pdoc.csv` (SHA `f1aa1178ecfce9717716aa210ff3564ed33177542130c43824125dafc1458478`)
- **Modo de masa:** **p_doc**
- **N elegible:** 511 · **median_S_raw:** 0.783039169827422 → published 3dec **0.783**
- **Vector:** `figure4_stability.csv` (columnas `journal_id,S,n_year_pairs,eligible[,status]`)
- **Distribución:** min=0.300152 q1=0.713032 mean=0.776364 q3=0.860578 max=0.994281

### Backward shift
- **Fuente/comando:** `robustez_perfil.compare_pair(W0,W-1)` + `diag_entropia` H_raw
- **Modo:** **p_cit** · ventanas W0_2021_2024 vs W-1_2020_2023 · N=522
- **Correlaciones forma:** Pearson (TCI, H_norm en robustez; H_raw en diag)
- **JSD:** nats (ln), no log2
- Brutos: JSD_med=0.045861373324040 · Jac_med=1.0 · Jac≥0.90=0.519157088122605 · dom=0.821839080459770 · TCI=0.825741671408751 · H=0.897690640453960 · Hn=0.763174302392666

### Taxonomic coarsening
- **Fuente/comando:** `python scripts/pruebaB_taxonomica.py` (stdout de esta extracción)
- **Modo:** **p_cit** · misma ventana W0; transformación subfield→field
- **Correlaciones B3:** **Spearman** ρ (no Pearson)
- Brutos parseados: N=522 · B1=0.965 · Jac_med=1.0 · %J≥0.70=0.787 · TCI ρ=0.683 · Hn ρ=0.62 · H ρ=0.772

---

## C · Controles obligatorios

| Control | Resultado | Detalle |
|---|---|---|
| `sum(cells)==521` | **PASS** | sum=521 |
| `len(S eligible)==511` | **PASS** | n=511 |
| `median(S)` estable (tol 1e-12 vs extract Ronda 3) | **PASS** | 0.783039169827422 |
| R² H → 0.40 bajo R1 **2dec** | **FAIL** | 2dec=0.39 (V1.2 publica **0.395** a 3dec: PASS) |
| R² TCI → 0.50 bajo R1 **2dec** | **PASS** | 2dec=0.5; 3dec=0.496 |
| Ningún dato leído del manuscrito/Supp | **PASS** | solo CSV/JSON/SQL/scripts |
| Agrupación binaria D | **DISPONIBLE** | `spec_MD_cientifica.md` §Matriz 2×2 |

**Nota R1 / 0.40:** el control “bruto redondea a 0.40” **falla** a 2 decimales (0.39). El valor científico congelado en V1.2 §5.5 es **0.395** (3 dec). No se forzó `r2_published=0.40` en el JSON.

---

## Campos no disponibles / matices
- `jaccard_pct_ge_090` backward: **no** está en el log de `robustez_perfil` como campo depositado; se **recomputó** en esta extracción con la misma lógica `core_set`/`topk_jacc` del script congelado (N=522).
- R² “publicado 0.40”: **no** respaldado por R1 a 2 dec; usar 0.395 (3dec) o declarar regla distinta.
- Snapshot_id: tomado de `audit_A_prima_consistency` (`9844f2c9e1dedd7328b5299702591c7c26da6f29c39fc67bcb04b3b2e9814ff3`), identificador del entorno A′, no un hash del frame M/D.

---

*Extracción final Figuras 3–4 · anti-circularidad · sin edición de paper.*
