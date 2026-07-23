# Registro de versiones — manuscrito "Reconstrucción de la identidad temática"

Texto fuente: **español**. La traducción al inglés se hace sobre una versión española congelada.

> **Registro canónico:** este archivo (`docs/paper2/VERSIONES.md`) en el repo (archivos vivos). Ante divergencia, **prevalecen los hashes del repo** sobre cualquier copia de trabajo o borrador “as-designed”.  
> Hashes de paquete **vivos (autoritativos)** al 2026-07-23:  
> - paquete C = `cc71d49ed93e6268`  
> - paquete A′ = `91503f91ae7d27e0` *(Enmiendas 1+2 autoritativas en repo; declarado externo `9cbc7b536d21292a` no coincidió — no forzado)*  
> Los hashes “as-designed” de borradores externos difieren porque los archivos vivos se adaptaron al esquema (poblar S2, parchear SQL, config de A′).
>
> **✅ FASE 1 CERRADA (2026-07-22).** Durante la verificación no se localizaron copias externas de los manuscritos v1.0 y v1.1. Los únicos ejemplares existentes son los almacenados en `docs/paper2/`, cuya integridad fue verificada mediante `verificar_fase1.sh`. En consecuencia, **estos archivos constituyen los manuscritos canónicos del proyecto y su SHA256 es la referencia autoritativa**. Los hashes `3f1529…` / `21ace3…` fueron **referencias del desarrollo**; el canónico es el del archivo depositado. En reproducibilidad lo que importa es que cualquiera pueda obtener el mismo archivo y verificarlo contra el hash canónico publicado — condición ya cumplida.
>
> SHA256 completos **canónicos (repo)**:
> - v1.0-es-freeze-preC: `8c184f8aba95f7a08a2cf9faf47181924967ad2591d41498e619d41dd5032740`
> - v1.1-es-final: `9ef46d28e6f815ffe6dd78680bead44109b4db59ab64149341e76599c0e95d70`
> - v1.2-es-final: `7ab6a4366214e9056c0656f416c831a247bcdc64fd7dbc915485cc12cb984bcc`
> - v1.2.1-es-final: `7251c63817af2d83db9b06512a650dbf2b1bc1795370b31ac01a52fedd5c38d2`
>
> Referencias del desarrollo (no canónicas): `3f1529123412dd993854827f4a8099ce52576d434bf573372467b8240195c769` (v1.0), `21ace3b22c6c5ff823072f9eaa3a18eeb86b1584261186a111a1f9ea61e2e829` (v1.1).  
> Script: `docs/paper2/verificar_fase1.sh`

| Versión | Fecha | Estado | SHA256 (16) | Archivo · Notas |
|---|---|---|---|---|
| **v1.0-es-freeze-preC** | 2026-07-22 | 🔒 **canónica en repo, verificada** | `8c184f8aba95f7a0` | `docs/paper2/manuscrito_identidad_tematica_v1.0-es-freeze-preC.md` — fuente estable **antes** de la Prueba C. Canónico = archivo del repo. |
| **v1.1-es-final** | 2026-07-22 | 🔒 **canónica en repo, verificada** | `9ef46d28e6f815ff` | `docs/paper2/manuscrito_identidad_tematica_v1.1-es-final.md` — **Prueba C / C0** como §5.9 (reproducibilidad operacional). **Inalterada** tras A′. |
| **v1.2-es-final** | 2026-07-23 | 🔒 **canónica en repo** | `7ab6a4366214e905` | `docs/paper2/manuscrito_identidad_tematica_v1.2-es-final.md` — A′ integrada (§5.10), Rama 3 **DEBILITA**; estatus → evidencia mixta. **Inalterada** tras v1.2.1. |
| **v1.2.1-es-final** | 2026-07-23 | 🔒 **canónica en repo** | `7251c63817af2d83` | `docs/paper2/manuscrito_identidad_tematica_v1.2.1-es-final.md` — Refinamiento epistemológico (hipótesis emergente; confound `p_cit` explícito); veredicto/números sin cambio. Fuente para traducir → v1.2.1-en. |
| v1.2.1-en | *(pendiente)* | — | — | Traducción al inglés de v1.2.1-es-final. |
| v1.2-en | *(pendiente)* | — | — | Traducción al inglés de v1.2-es-final (histórico; preferir v1.2.1-en). |
| v1.1-en | *(pendiente)* | — | — | Traducción al inglés de v1.1-es-final (histórico; preferir v1.2-en). |

---

## Estado del proyecto (a v1.0-es-freeze-preC)

| Frente | Situación |
|---|---|
| Arquitectura conceptual | Cerrada |
| Evidencia empírica principal | Cerrada |
| Comunicación científica | Pulida |
| Validación externa (Prueba C) | **C0 ejecutada** (1 día) e integrada en v1.1; C-meses pendiente por diseño |

---

## Política de modificaciones del protocolo

Después del congelamiento de v1.1, toda modificación metodológica se clasifica como:

- **Plumbing:** cambios de infraestructura (configuración, nombres de tablas, rutas, SQL equivalente). **No** altera el protocolo; se anota, no requiere enmienda.
- **Enmienda:** modificación de métricas, umbrales, criterios de decisión o interpretación pre-registrada. Requiere **fecha, justificación y nuevo hash**.

Ejemplos ya registrados:

- Adaptación de `CONFIG_APRIMA` y consultas de A′ = **plumbing** (atestado).
- Enmienda 1 del pre-registro de C (intervalo de extracción / lectura C0) = **enmienda** (fechada 2026-07-22).
- **Enmienda 1 del pre-registro A′** (2026-07-22) = **enmienda** de documentación (diagnósticos, panel, alcance, secciones).
- **Enmienda 2 del pre-registro A′** (2026-07-23) = **enmienda** de alineación técnica + operacionalización `estruct_ok×forma_techo` (umbrales numéricos intactos) + plumbing `QUERY_YEARLY`.

---

## Condición de descongelamiento de v1.0-es-freeze-preC

**Únicamente** la incorporación de los resultados de la **Prueba C** ejecutada conforme al protocolo pre-registrado (`preregistro_pruebaC.md`). **No** se aceptan modificaciones metodológicas, cambios de umbrales ni reestructuración del manuscrito — **salvo** que la Prueba C revele un resultado inesperado que exija reinterpretación científica, en cuyo caso el cambio se documenta explícitamente como excepción fechada.

*(Cumplido para C0 → v1.1; A′ no reabre v1.1 — va a v1.2.)*

---

## Estado del protocolo

| Protocolo | Estado |
|---|---|
| Prueba A (reproducibilidad temporal) | Cerrado |
| Prueba B (robustez taxonómica) | Cerrado |
| Estabilidad S (p_doc) | Cerrado |
| Discriminante JCA (N=521) | Cerrado |
| Universo y cohortes (marco muestral / 521 / 522) | Cerrado |
| **C0 — snapshot 1 día (reproducibilidad operacional)** | **Cerrado** (§5.9, integrado en v1.1; JSD med=0.000) |
| **A′ — réplica temporal prospectiva (2022–2025)** | **Ejecutada e integrada (DEBILITA)** — §5.10 en v1.2; panel común 506; masa `p_cit`; forma estable, microestructura reorganizada. |
| **Réplica `p_doc` (mismas ventanas)** | **Pendiente prioritaria** — discriminador primario del confound `p_cit` (misma cohorte temporal; cambia solo la ponderación). |
| **Ventanas citacionalmente maduras** | **Corroboración futura** — secundaria; salvedad de época de cobertura OpenAlex. |
| **C-meses — maduración de datos (snapshot meses)** | **Corroboración futura** — eje genuinamente distinto; re-medir tras acumulación de citas. |

---

## Registro de ejecuciones

| Fecha | Evento | Resultado | Efecto sobre el manuscrito |
|---|---|---|---|
| 2026-07-22 | Prueba C · intento 1 (S1=2026-07-21, S2=2026-07-22, intervalo 1 día) | Perturbación ≈ 0 (JSD med=0.000). Reproducibilidad operacional confirmada; escasa capacidad discriminante. Veredicto automático "DEBILITA" descartado como artefacto de techo. | **Integrado en v1.1 como §5.9.** Hipótesis estructura/dinámica **sin cambio**; umbrales sin enmienda. |
| 2026-07-22 | Cierre Fase 1 | Sin copias externas; manuscritos del repo = canónicos; `verificar_fase1.sh` ✅ | Hashes canónicos fijados en este archivo. |
| 2026-07-22 | Playbook A′ → v1.2 | Pre-escrito **antes** de observar A′; cuatro ramas fijas | `docs/paper2/playbook_A_prima_v1.2.md` (SHA16 `002f5bea38effe3a`). |
| 2026-07-22 | **Enmienda 1** pre-registro A′ + script | Magnitud (diagnóstico NO clasifica); panel; rejilla ≠ JCA/M/D; §8 intacto. | — |
| 2026-07-23 | **Enmienda 2** A′ (texto autoritativo) | Alineación técnica; rejilla `estruct_ok×forma_techo`; sin cambio de umbrales/lecturas. | Paquete A′ = `91503f91ae7d27e0` (completo abajo). |
| 2026-07-23 | A′ (W0 vs W+1, panel común 506) | **DEBILITA**; perturbación real (JSD `p_cit` med 0.071, 2.6% ≤0.01); forma estable, microestructura reorganizada | **Integrado en v1.2 §5.10**; estatus → evidencia mixta. Ajuste de redacción Rama 3 atestado (CHANGELOG). |
| 2026-07-23 | Congelamiento **v1.2-es-final** | Rama 3 (DEBILITA); métrica masa `p_cit`; §8 intacto; v1.1 inalterada | SHA256 `7ab6a4366214e905…` · `CHANGELOG.md` |
| 2026-07-23 | **v1.2.1** refinamiento epistemológico | Interpretación degradada a **hipótesis emergente**; confound `p_cit` explícito; retira macro/micro como afirmación | Sin cambio de veredicto/estatus/números; SHA256 `7251c63817af2d83…` |

---

## Secuencia al llegar snap2 (estricta)

1. Validar `manifiesto_snap2.yaml` y `validar_S2.sql`.
2. Ejecutar `scripts/pruebaC_snapshot.py` **sin** modificar umbrales.
3. Incorporar solo en §5 / §6 / §8 / Apéndice C.
4. Revisión de consistencia.
5. Congelar **v1.1-es-final**.
6. Traducir → **v1.1-en**.

*(C0 ya ejecutó esta secuencia el 2026-07-22.)*

**Política de nuevas versiones:** la integración de A′ **no modifica v1.1-es-final**. Se crea **v1.2-es-final**.

**v1.2 es incondicional respecto del resultado de A′.** v1.2-es-final se crea **cualquiera que sea** el resultado de A′ (favorable, mixto o desfavorable). El resultado determina **qué interpretación** contiene v1.2 —según la rejilla de cuatro del pre-registro y el **playbook textual** `playbook_A_prima_v1.2.md`—, **no** si v1.2 existe o se publica. Al integrar: elegir la rama, rellenar 【slots】, sin libertad narrativa. Registrar el resultado íntegro aunque no confirme la hipótesis.

Secuencia: Fase 1 cerrada → playbook congelado → confirmar plumbing de A′ → ejecutar A′ sin tocar el protocolo → integrar en **v1.2-es-final** según la rama → traducir.

---

## Paquete metodológico de la Prueba C

### Hashes vivos (autoritativos) — 2026-07-22

Orden fijo: `preregistro_pruebaC.md` → `validar_S2.sql` → `manifiesto_snap2.yaml` → `pruebaC_snapshot.py`.

| Archivo (ruta en repo) | SHA256 (16) |
|---|---|
| `docs/paper2/preregistro_pruebaC.md` | `010ab3322f2be12d` |
| `scripts/validar_S2.sql` | `6fe00617dfc9ed7f` |
| `docs/paper2/manifiesto_snap2.yaml` | `6dcd6b7b71b21772` |
| `scripts/pruebaC_snapshot.py` | `0be3ff6be2f87ae3` |
| **Paquete C combinado** | **`cc71d49ed93e6268`** |

### Hashes “as-designed” (no autoritativos)

| Archivo | SHA256 (16) |
|---|---|
| `preregistro_pruebaC.md` | `e138aece7300700f` |
| `validar_S2.sql` | `682f1b9c8eeac11f` |
| `manifiesto_snap2.yaml` | `7a787b15d6f791e6` |
| `prueba_C_snapshot.py` | `06cbe28fd26bf4a7` |
| **Paquete combinado (as-designed)** | **`885f8a162f621a57`** |

---

## Paquete Prueba A′

### Hashes vivos (autoritativos) — 2026-07-23 · post Enmienda 2

| Archivo | SHA256 (16) | SHA256 completo |
|---|---|---|
| `docs/paper2/preregistro_pruebaA_prima.md` | `e08ce26c0a8f39b0` | `e08ce26c0a8f39b05d05aa1c1667301e79160810c5f8692f036b8862b648b982` |
| `scripts/prueba_A_prima.py` | `08a0e48a293096f3` | `08a0e48a293096f329caed0f85ce6806b49065b4974f4f807e970747ae838769` |
| **Paquete A′ combinado** | **`91503f91ae7d27e0`** | **`91503f91ae7d27e09aba14b66581666e679022ea3ef1bc274e4eff38b4f615a2`** |

Poblado: `scripts/populate_A_prima.py` (fuera del hash del paquete de análisis).  
Playbook textual: `docs/paper2/playbook_A_prima_v1.2.md` (SHA16 `002f5bea38effe3a`).

Referencia externa del autor (no canónica; no forzada): combinado `9cbc7b536d21292a…` · prereg `df16b2f87a560a04…` · script `b7b705d7a03a14f8…`.  
Hashes previos del paquete A′ (supersedidos): `d9895293…` → … → `de640264…` → **`91503f91ae7d27e0`**.

Plumbing atestado en script: `QUERY_YEARLY` → `journal_yearly_doc` (columna `d`).

### Hash “as-designed” (no autoritativo)

| | SHA256 (16) |
|---|---|
| **Paquete A′ combinado (as-designed)** | **`332dbdfbaf752313`** |

---

## Documentos de soporte del marco

En repo: `programa_metricas_identidad_v2.md` · `paper2_v3_esqueleto.md` · `preregistro_pruebaB.md` · `preregistro_S_pdoc.md` · `spec_MD_cientifica.md` · `seccion_3_3_estabilidad_S.md` · `playbook_A_prima_v1.2.md` · etc.

Pendientes de depósito si existen fuera del árbol: `teorema_marco.md` · `spec_universo_seleccion.md` · figuras.

---

## Línea paralela · Journal Identity Analytics (JIA)

**No forma parte del paquete científico del paper.** Track de producto: consume/versiona/valida/expone resultados del pipeline autorizado; **no recalcula** el método; **no toca** manuscritos ni paquetes A′/C.

| Doc | SHA256 (16) | Notas |
|---|---|---|
| `docs/jia/spec_JIA_v2.md` | `ba17d1d00338fb64` | Especificación v2 (+ enlace DDL v2.1). Fase 1 del plan JIA. |
| `docs/jia/jia_schema_v2.1.sql` | `4ecc0adc3dd6eec9` | DDL v2.1 (review): `config_uid`, estabilidad↔run, `chk_comparison_state`, `v_passport`, `parity_check`. Fase 2 (días 8–12). |
| `docs/jia/nota_diseno_journal_intelligence_v1.md` | `5d5cea257bfce234` | **Arquitectura aprobada** del módulo operativo (`journal-intelligence`). Extiende JIA a dinámica/alertas/frontera; **no implementa**. Subordinada al pipeline del paper. Completo: `5d5cea257bfce234478b07660398e4e840feb925a65b31b2750cb95ed78fd464`. |
| `docs/jia/spec_JIA_funcional_v1.0.md` | `b607eb9394729447` | Especificación funcional v1.0 (**supersedida** por v1.0.1). Completo: `b607eb93947294470e5a129f15e388084b1ce764b8009651bc922b8915b9d5c1`. |
| `docs/jia/spec_JIA_funcional_v1.0.1.md` | `e2982c2e65018916` | **NORMATIVA — APROBADA PARA IMPLEMENTACIÓN** (delta C1–C12: unidad revista/panel, núcleo≥τ verificado, topic_change, article_fit fuera del mínimo). Completo: `e2982c2e65018916bf8c1348b3f6e29f9c9534860f427eb7300cb7caecb2e847`. |

Prioridad cede ante el envío del paper si compiten. Implementación JIA **después** de: v1.2.1 → réplica `p_doc` → traducción → envío.

---

## Próximo paso operativo

1. ~~Cierre Fase 1~~ ✅
2. ~~Playbook A′ → v1.2~~ ✅ (`playbook_A_prima_v1.2.md`)
3. ~~Poblar `W+1_2022_2025` → ejecutar A′ → rama → **v1.2-es-final**~~ ✅ (2026-07-23, DEBILITA)
4. Traducción → **v1.2.1-en** (desde v1.2.1-es-final).
5. Prioridad científica: **réplica `p_doc`** (discriminador primario) · ventanas maduras · C-meses.
6. *(Paralelo, cede ante 4–5)* JIA: aplicar `docs/jia/jia_schema_v2.1.sql` → job de materialización + paridad con paper.
