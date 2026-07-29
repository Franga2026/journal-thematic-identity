# release_audit_report.md — Auditoría `release-qss-v1` · ronda 2

**Fecha:** 2026-07-27  
**Rama:** `release-qss-v1`  
**Matriz:** `docs/paper2/matriz_verificacion_numerica.md` (R4 p_doc **corregida** → panel común)  
**SHA-256 matriz:** `d3bc5cd539d2ad6779a4d8addeacec11acec3a525224ba2c1471e5552356052b`  
**Cambio vs ronda 1:** fuente de verdad p_doc = `analisis_A_prima_pdoc_panel_comun.json` (`pdoc_comun`), no el manifiest natural.

---
## Veredicto

```
Discrepancias detectadas: 25
  (ya no: p_doc Tabla1 vs manifiest natural — resuelto por corrección R4)
  restantes: fuentes cohorte/backward/descriptores ausentes; ⟦…⟧ Supp; R² rango vs 0.392
Release NO apto para congelación hasta resolver.
```

### Confirmación pedida por la matriz (§6 nota)

- Archivo: `cris-discovery-api/analisis_A_prima_pdoc_panel_comun.json` SHA `0a98c292284b5caf0077c679f5647524410c6fabf1c628f9f47b38bcc57d6cab`
- `panel_comun.N` = **506**
- `pdoc_comun` → JSD 0.028 · Jac90 72.9% · Dom 95.8% · forma [0.968, 0.968, 0.966] · pert 10.1%
- `pcit_comun` → JSD 0.071 · Jac90 52.6% · Dom 85.0% · forma [0.852, 0.896, 0.827] → **iguala** 0.071/52.6/85.0 (y manifiest p_cit): `SÍ`
- **Ambas columnas de la Tabla 1 trazan al panel común 506.**

---
## Conteos

| § | N | ✅ | ⚠ |
|---|---:|---:|---:|
| 1 | 5 | 1 | 4 |
| 2 | 2 | 2 | 0 |
| 3 | 3 | 0 | 3 |
| 4 | 5 | 5 | 0 |
| 5 | 6 | 6 | 0 |
| 6 | 6 | 6 | 0 |
| 7 | 11 | 5 | 6 |
| 8 | 4 | 4 | 0 |
| 9 | 14 | 4 | 10 |
| 10 | 11 | 9 | 2 |

| Total | **67** | **42** | **25** |

### ⚠ restantes

| § | Fila | Cat. | Nota |
|---|---|---|---|
| 1 | `n_frame` | trazabilidad | manifiesto cohorte AUSENTE |
| 1 | `n_comparable` | trazabilidad | manifiesto cohorte AUSENTE |
| 1 | `n_analytic` | trazabilidad | manifiesto cohorte AUSENTE |
| 1 | `n_subfields` | trazabilidad | manifiesto cohorte AUSENTE |
| 3 | `n_tipologia` | trazabilidad | manifiesto cohorte AUSENTE |
| 3 | `R2` | metodológica | jca_discriminant_2024.json |
| 3 | `mean_dominant_share` | trazabilidad | manifiesto descriptores AUSENTE |
| 7 | `REF_A_jsd` | trazabilidad | manifiesto backward AUSENTE |
| 7 | `REF_A_jacc` | trazabilidad | manifiesto backward AUSENTE |
| 7 | `REF_A_dom` | trazabilidad | manifiesto backward AUSENTE |
| 7 | `REF_A_tci` | trazabilidad | manifiesto backward AUSENTE |
| 7 | `REF_A_H` | trazabilidad | manifiesto backward AUSENTE |
| 7 | `REF_A_Hn` | trazabilidad | manifiesto backward AUSENTE |
| 9 | `hash_prereg` | editorial | ⟦…⟧ |
| 9 | `hash_pdoc` | editorial | prefijo; full no en Supp (archivo válido, no origen Tabla1) |
| 9 | `hash_runbook` | editorial | ⟦…⟧ |
| 9 | `float_tol` | editorial | ⟦…⟧ |
| 9 | `def_M` | editorial | ⟦…⟧ |
| 9 | `def_D` | editorial | ⟦…⟧ |
| 9 | `URL` | editorial | ⟦URL⟧ |
| 9 | `DOI` | editorial | ⟦DOI⟧ |
| 9 | `Tabla_S1` | trazabilidad | cohorte AUSENTE |
| 9 | `Tabla_S2` | editorial | empírico 0; Supp ⟦…⟧ |
| 10 | `0.046` | trazabilidad | backward AUSENTE |
| 10 | `521_522_1461` | trazabilidad | cohorte AUSENTE |

### ✅ cerrados tras corrección R4 (antes ⚠ en ronda 1)

- §4 pct≤0.01 p_doc · §6 las 6 métricas p_doc · §10 clústeres 0.028 / 72.9 / 95.8 / dom_frac / mean_shape (p_doc)

### Figuras 3–4

No producidas. Contratos §11–12: parciales (S CSV; R² JSON; tipología 2×2 ausente).

---
*Ronda 2 · matriz R4 corregida · único artefacto de salida adicional: este informe (la matriz sí se actualizó por instrucción del usuario).*
