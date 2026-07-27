# INSTRUCCIÓN CURSOR — Auditoría de cierre `release-qss-v1`

## Contexto y rol
Estamos en la rama `release-qss-v1`. El manuscrito, el Supplementary y el **protocolo de auditoría** (`matriz_verificacion_numerica.md`) están **congelados**. Tu rol es **ejecutar** el protocolo ya definido, **no** diseñarlo, mejorarlo ni reinterpretar resultados.

**La lista de verificación es `matriz_verificacion_numerica.md`.** No inventes filas ni fuentes: ejecuta las filas de las §§1–9, los chequeos cruzados de la §10, y usa la **tabla de fuentes de verdad de R4** tal como está — no la re-deduzcas.

**No modifiques ningún archivo durante esta ejecución.** No corrijas discrepancias en este pase: solo detéctalas, clasifícalas e infórmalas. Las correcciones son un pase posterior.

## Reglas que gobiernan todo el pase (del protocolo, no negociables)
- **R1 — no validar por redondeo visual.** Para cada cifra registra **tres columnas**: `valor_bruto` (del archivo), `regla_redondeo`, `valor_publicado`. Una diferencia que respeta la regla es *presentación*, no discrepancia; solo es ⚠ si el bruto no redondea al publicado bajo la regla declarada.
- **R2 — ningún hash por inferencia.** Todos los SHA-256 se **recalculan** directamente sobre el archivo. En particular, la igualdad "manifiesto canónico `9fb560d7…` = manifiesto p_cit" es **hipótesis**: confírmala por (a) nombre exacto del archivo, (b) contenido, (c) rol en el runbook, (d) hash recalculado. No la des por cierta.
- **R3 — extraer, no transcribir.** Todo valor se lee del archivo **mediante código**, nunca a ojo.
- **R4 — una única fuente de verdad por cifra.** Extrae cada cifra de su **fuente de verdad** (tabla en `matriz…§R4`) y verifica que las **copias de presentación** (manuscrito, tabla, figura, Supplementary) coincidan **con la fuente**, no entre sí. Si dos copias coinciden pero difieren del origen, **gana el origen** y la copia queda marcada ⚠.

> ⚠ Corrección al enunciado habitual "comparar con el manuscrito": es al revés. El manuscrito es una **copia de presentación**; se compara **contra la fuente de verdad**, no se toma como referencia.

---

## Fase 1 — Inventario
Localiza todos los artefactos que produjeron el paper: manifiestos, runbooks, scripts, tablas, logs, resultados, snapshots, figuras. Para cada uno informa:
- ruta
- función
- **capa de evidencia** (normativa / empírica / presentación / reproducibilidad)
- **fuente de verdad o derivado** (según la tabla R4)
- quién lo genera · quién lo consume
- **SHA-256 recalculado** (si corresponde)

Marca explícitamente cualquier artefacto referido en la matriz que **no** encuentres en el repo.

## Fase 2 — Verificación (sin corregir)
Ejecuta **todas** las filas de las §§1–9 de la matriz. Para cada fila:
1. abre el **archivo fuente de verdad** (no la copia de presentación);
2. extrae el valor **por código** (R3) → registra `valor_bruto`;
3. aplica la `regla_redondeo` declarada → obtén `valor_publicado_recomputado` (R1);
4. recalcula hashes donde aplique (R2);
5. compara `valor_publicado_recomputado` con lo que dice **cada** copia de presentación (manuscrito / Tabla 1 / figura / Supplementary) (R4);
6. marca `✅ coincide` o `⚠ discrepancia`, **indicando la capa** donde aparece.

### Fase 2b — Chequeos cruzados (§10) — obligatoria
Para cada clúster de la §10 (0.046 · 0.071 · 0.028 · 52.6 · 72.9 · 85.0 · 95.8 · 506 · 521/522/1461 · persistencia dominante fracción=%, · "mean shape" = media de las tres correlaciones), verifica que **todas** las apariciones (texto, Tabla 1, Figura 5) coincidan **con la fuente de verdad**. Recomputa las medias de forma de la Figura 5 panel c y confirma que igualan la media de las tres correlaciones del manifiesto correspondiente. Este paso es donde se atrapa el caso "dos derivadas concuerdan pero difieren del origen".

> **Nota sobre figuras:** solo las Figuras 1, 2 y 5 existen; verifícalas. Las Figuras 3 y 4 **aún no se producen** — para ellas, verifica únicamente que sus **datos de entrada** (contratos §§11–12 de la matriz) existan y sean correctos; no marques "figura consistente" para 3–4.

## Fase 3 — Diagnóstico (sin proponer soluciones)
Clasifica **cada** ⚠ en exactamente una categoría, según la capa donde nace (clave diagnóstica del protocolo):
- **metodológica** — manifiesto ≠ preregistro (empírica ↔ normativa)
- **editorial** — manuscrito/figura/tabla/Supplementary ≠ manifiesto (presentación ↔ empírica)
- **trazabilidad** — SHA-256 no coincide
- **reproducibilidad** — reproduction diff ≠ 0

No propongas correcciones todavía.

## Fase 4 — Informe → guardar como `release_audit_report.md`
Genera el informe y **guárdalo como archivo** `release_audit_report.md` en el proyecto (es la evidencia de que el cierre fue auditado sistemáticamente; útil si en la revisión por pares surge una duda sobre una cifra o un hash). Debe indicar:
- número total de verificaciones ejecutadas (= filas §§1–9 + clústeres §10; **cuéntalo, no lo asumas** — no uses un total prefijado)
- número de coincidencias `✅`
- número de discrepancias `⚠`
- clasificación de cada discrepancia (Fase 3)
- archivos afectados
- para cada discrepancia: `valor_bruto`, `regla`, `valor_publicado`, y la fuente de verdad relevante
- **veredicto:** ¿el PDF puede congelarse o no?

### Plantilla de cierre (si todo coincide)
```
Estado release-qss-v1
- Verificaciones: N/N
- Discrepancias: 0
- Hashes: recalculados y verificados
- Chequeos cruzados (§10): cierran
- Figuras 1/2/5: consistentes  ·  Figuras 3/4: datos de entrada verificados (aún no producidas)
- Supplementary: consistente
- Manuscrito: consistente
- Release APTO para congelación (falta producir Figuras 3–4 y completar ⟦…⟧ del Supplementary con datos ya verificados).
```
### Si hay problemas
```
Discrepancias detectadas: k
  1. <categoría> — <archivo> — bruto <x> vs publicado <y>
  ...
Release NO apto para congelación hasta resolver.
```

## Prohibido en este pase
- Modificar manuscrito, Supplementary, figuras, protocolo o cualquier archivo del repo.
- Corregir discrepancias (van a un pase posterior).
- Reinterpretar resultados o "mejorar" cualquier cosa.
- Rellenar `⟦…⟧` (eso es producción posterior, con datos ya verificados).
- Asumir un total de verificaciones prefijado.

> Salida del pase: (1) inventario, (2) matriz con `Estado` completado por fila, (3) `release_audit_report.md`. Nada más.
