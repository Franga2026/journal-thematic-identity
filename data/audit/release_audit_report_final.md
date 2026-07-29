# release_audit_report_final.md — Cierre `release-qss-v1`

**Fecha:** 2026-07-28  
**Rama:** `release-qss-v1`  
**Sello:** **66 ✅ / 0 ⚠ / 2 ⏳** (URL/DOI pendientes de depósito Zenodo)

---

## Bloque A — Confirmación de valores ya validados

| Valor | Resultado | Bruto / detalle |
|---|---|---|
| Definición M · reglas D (FRAC_CORE_NUC=0.50, EPS_DESPL=0.05) | **coincide** | `spec_MD_cientifica.md` / `md_intrinsecos.py` |
| `float_tol` | **coincide** | `1e-12` |
| R² `\|E\|+logN+H` | **coincide** | 0.394809361560552 → 0.395 |
| R² `\|E\|+logN+TCI` | **coincide** | 0.495676061260238 → 0.496 |
| Tipología M×D 415/0/70/36 Σ521 | **coincide** | `md_intrinsecos_W0.csv` (`M_lvl`×`D_lvl`) |
| `mean_dominant_share` | **coincide** | 0.474507471264368 → 0.4745 (4dec) |
| `median_S` · N | **coincide** | 0.783039169827422 → 0.783 · N=511 (`status=ok`) |
| Hash p_cit prefijo `9fb560d7` | **coincide** | `9fb560d7d53722a16125181f598cf678c2d1664ee055cacc5d39bd1322ed73ea` |
| Panel común · Tabla 1 p_cit/p_doc | **coincide** | N=506 · 0.071/52.6/85.0 · 0.028/72.9/95.8 |

**Fallos de coincidencia:** ninguno.

---

## Bloque B — Supplementary `⟦…⟧`

Rellenados desde artefactos (SHA recalculados). Quedan solo depósito:

| Campo | Valor |
|---|---|
| S2 M / D | fórmulas operacionales (τ=0.5, ε=0.05, FRAC_CORE=0.50) |
| S4.3 hashes | prereg / script / p_cit / p_doc / runbook (completos) |
| S5 float_tol · env · snapshot | `1e-12` / `3e5e937b…` / `9844f2c9…` |
| Table S1 / S2 | subcampos + reproduction diff aggregate 0 |
| S6 URL / DOI | **siguen** `⟦URL⟧` / `⟦DOI⟧` (**⏳** pendiente depósito) |

---

## Bloque C — Matriz §§1–10 (sello final)

| Conteo | N |
|---|---:|
| ✅ PASS | **66** (filas §§1–9 + clústeres §10) |
| ⚠️ WARN | **0** |
| ⏳ pendiente depósito | **2** (URL · DOI) |

### §6.2 / R² (cerrado)

Manuscrito alineado con artefacto: `R² = 0.395 for the entropy specification` · TCI `0.496`; sin “intrinsic descriptors” / `0.40–0.50`; Supp sin `(M, D)` como especificación del discriminante.

### ⏳ no cuentan como discrepancia numérica
- S6 URL · S6 DOI

### §10 chequeos cruzados
Clústeres 0.046 · 0.071 · 0.028 · 52.6 · 72.9 · 85.0 · 95.8 · 506 · 521/522/1461 · fracciones dominantes · mean shape → **PASS**.

---

## Bloque D — Freeze PDF / Zenodo

**Desbloqueado numéricamente** (0 ⚠ de especificación/cifras).  
**Pendiente operativo:** depositar Zenodo → rellenar URL/DOI → re-sellar hashes del Supplementary → congelar PDF.

---

## Hashes recalculados (R2) — sello

| Artefacto | SHA-256 |
|---|---|
| `preregistro_pruebaA_prima.md` | `e08ce26c0a8f39b05d05aa1c1667301e79160810c5f8692f036b8862b648b982` |
| `prueba_A_prima.py` | `08a0e48a293096f329caed0f85ce6806b49065b4974f4f807e970747ae838769` |
| `manifest_A_prima.json` | `9fb560d7d53722a16125181f598cf678c2d1664ee055cacc5d39bd1322ed73ea` |
| `manifest_A_prima_pdoc.json` | `70d1ae785a4effd759d04de984228ff989f0fb5a7cfe674914636aa197ac86b4` |
| `runbook_A_prima_pdoc_v1.0.md` | `36b3a95e3ec44536084aeab71bf91155cc2512a96500584db04a242e2f678363` |
| `audit_prueba_A_prima_requirements.txt` | `3e5e937b316c05aeb0637b90687e4dd98182bc3581cb1c91017dbec46770305a` |
| `DRAFT_QSS_manuscript_full.md` | `d1273b5f24b7902ea2e52628834fe766e98302f6f5f4704677b1a27a0884ad15` |
| `DRAFT_QSS_supplementary.md` | `637e9b98adfa0b0c22a7383562bcdb94d28b7155c0295d365265503aa1e9279d` |
| `matriz_verificacion_numerica.md` | `d10761774a8013f5993bcb2435f8766ede04439b70ebb0e8d9588f3d7da7db0d` |

---

*Sello final numérico · 0 ⚠ · Phase D operativa pendiente solo de depósito URL/DOI.*
