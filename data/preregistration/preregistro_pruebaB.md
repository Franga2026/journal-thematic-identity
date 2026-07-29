# Prerregistro — Prueba B (robustez taxonómica subfield → field)

**Estado:** umbrales **PRE-REGISTRADOS** (2026-07-22). No modificar sin enmienda fechada.  
**Script:** `scripts/pruebaB_taxonomica.py`  
**Insumo:** `journal_identity_profile` config `W0_2021_2024` + mapa `subfield_field_map` (desde `openalex_topics`).  
**No re-extrae.** El perfil a nivel field = roll-up del perfil de subfields.

---

## Pregunta

¿La representación observada a nivel subfield se preserva al agregarla al nivel field de la taxonomía OpenAlex?

Tres criterios independientes (B1 estructural dominante, B2 núcleo, B3 forma ordinal).

---

## Umbrales

### B1 — estructura dominante
Coincidencia: parent(argmax subfield) == argmax field.

| | Éxito | Fracaso |
|---|---|---|
| Tasa de coincidencia | ≥ 0.90 | < 0.80 |

Reportar principal (excl. empates) y variante conservadora (empate = no match).

### B2 — núcleo por roll-up (Jaccard)
`R` = parents del núcleo τ=0.50 en subfield; `F` = núcleo τ=0.50 en field; `J = |R∩F|/|R∪F|`.

| | Éxito | Fracaso |
|---|---|---|
| Mediana J | ≥ 0.85 | < 0.70 |
| AND % con J ≥ 0.70 | ≥ 80% | — |

Éxito requiere **ambos**; fracaso si mediana J < 0.70; resto zona gris.

### B3 — preservación ordinal de la forma
Spearman entre niveles (subfield vs field) de TCI y de entropía.

| | Éxito | Fracaso |
|---|---|---|
| ρ | ≥ 0.90 | < 0.80 |

Descriptor de entropía para el **veredicto**: `H_norm` (mismo que Prueba A). `H_raw` se reporta como referencia.

---

## Veredictos separados

- **ESTRUCTURAL:** ÉXITO si B1 y B2 éxito; FRACASO si alguno fracaso; si no → ÉXITO PARCIAL.
- **FORMA · TCI** / **FORMA · entropía:** según umbrales B3.

**Hipótesis estructura≠dinámica:** apoyo convergente si estructura ÉXITO y alguna forma no-ÉXITO; sin apoyo si ambas formas ÉXITO; etc. (ver script).

---

## Mapa subfield → field

Tabla `subfield_field_map(subfield_id, field_id)` poblada desde `openalex_topics` (IDs normalizados sin prefijo URL). Cobertura esperada: 100% de los subfields en W0.

---

## Resultado congelado (2026-07-22)

Log: `logs/pruebaB_taxonomica.log` · mapa: `subfield_field_map` desde `openalex_topics` (252 entradas).  
n=522; sin field mapeado=1; empates dominante=4.

| Criterio | Valor | Veredicto |
|---|---:|---|
| B1 coincidencia (excl. indet., n=517) | **0.965** | ÉXITO |
| B1 conservadora | 0.962 | ÉXITO |
| B2 mediana Jaccard | **1.000** | |
| B2 % J≥0.70 | **78.7%** (<80%) | **ZONA GRIS** |
| B3 TCI ρ | **0.683** | FRACASO |
| B3 H_norm ρ | **0.620** | FRACASO |
| B3 H_raw ρ (ref.) | 0.772 | — |

**ESTRUCTURAL: ÉXITO PARCIAL** (B1 ok, B2 gris).  
**FORMA · TCI / H_norm: FRACASO.**  
Hipótesis estructura≠dinámica: **mixto** (casi convergente: estructura alta en B1/mediana B2, forma claramente inferior; el umbral de cola B2 impide ÉXITO estructural pleno).

No se enmiendan umbrales.
---

## Diagnóstico cola B2 (J<0.70) — 2026-07-22

Script: `scripts/diag_cola_B2.py` · log: `logs/diag_cola_B2.log`  
Cola: n=111 / 521 (21.3%). **No cambia** el veredicto B2 (zona gris).

| Naturaleza | n | % cola |
|---|---:|---:|
| Anidamiento limpio F⊆R, only_F=0 | **109** | **98.2%** |
| Desacuerdo real only_F>0 | 2 | 1.8% (=0.4% del total) |

Expansión |R|−|F|: mediana=1, máx=2. Retención mediana=**1.000**. Precisión mediana=**0.500**.

**Lectura:** la cola es casi toda **no conmutatividad de τ bajo agregación** (núcleo-field más compacto, anidado), no desacuerdo estructural. B2 permanece zona gris por umbral pre-registrado.
