# Auditoría — Ficha de coautor celeste

**Fecha:** 2026-06-10  
**Alcance:** solo lectura, sin cambios de código.  
**Componentes revisados:** `CoAuthorModal.tsx`, `WorkCard.tsx` (variant `coauthor`/`dataset`), `app.css`, `fwci.ts`, `datasetUsage.ts`, tests.

---

## A) Paleta / tokens

| ID | Estado | Evidencia | Nota |
|----|--------|-----------|------|
| **A1** | ✅ | `src/styles/app.css:2285-2294` | Los 9 tokens `--cel-*` están definidos en `.coauthor-modal` (no en `:root`). También `--ok-bg` / `--ok-text` scoped. |
| **A2** | ⚠️ | `src/styles/app.css:2285-2835` | La mayoría de reglas usan `var(--cel-*)`. Hex sueltos: `#fff` (fondos), `#78909d` (`2742`, `2759`). `--cel-cian` se define (`2288`) pero no se usa en ninguna regla. |

## B) Hero liviano

| ID | Estado | Evidencia | Nota |
|----|--------|-----------|------|
| **B1** | ✅ | `src/styles/app.css:2309-2314` | Hero `background: #fff`, `border-bottom: 1px solid var(--cel-linea)`. |
| **B2** | ✅ | `src/components/modals/CoAuthorModal.tsx:216-273` | Badge, nombre + check ORCID, afiliaciones, links ORCID·OpenAlex, botón cerrar. |
| **B3** | ✅ | `CoAuthorModal.tsx:275-442` vs `216-273` | Métricas (`275`), líneas (`391`), IA (`414`) y publicaciones (`444`) están en `.coauthor-body`, no en el hero. |

## C) Cuerpo + KPI grid

| ID | Estado | Evidencia | Nota |
|----|--------|-----------|------|
| **C1** | ✅ | `src/styles/app.css:2400-2404` | `.coauthor-body { background: var(--cel-fondo); }` |
| **C2** | ✅ | `CoAuthorModal.tsx:277-278` | Etiqueta única en el modal. `researcherMetrics.ts:13` es constante reutilizada en otro modal, no duplicada en UI del coautor. |
| **C3** | ✅ | `src/utils/coAuthorProfileView.ts:163-237` | Orden: Publicaciones → Datasets → Citas → Citas/pub → H-index → FWCI → Acceso abierto → Coautores UTA. Cards `#fff` + borde `--cel-linea` (`app.css:2462-2471`). |
| **C4** | ✅ | `coAuthorProfileView.ts:171-181,230-235` | Datasets y Coautores UTA siempre (incl. 0). Resto condicional (`works_count > 0`, `cited_by_count > 0`, etc.). Test: `coAuthorProfileView.test.ts:62-74`. |
| **C5** | ⚠️ | `WorkCard.tsx:395-415` · `coAuthorProfileView.ts:211-218` | **Obra (card):** `fwciIsEligible` + em dash `—` con clase muted. **KPI autor:** FWCI solo se agrega si hay número; no muestra `—` cuando no es elegible — omite la tarjeta. Verde `var(--ok-text)` si ≥1 (`app.css:2523-2524`, `CoAuthorModal.tsx:288`). |
| **C6** | ✅ | `app.css:2424-2430` | Chips líneas: `background: #fff`, `border: 1px solid var(--cel-borde)`. |
| **C7** | ✅ | `CoAuthorModal.tsx:414-441` | Botón `✨ Ver análisis IA completo` en el cuerpo. |

## D) WorkCard `variant="coauthor"`

| ID | Estado | Evidencia | Nota |
|----|--------|-----------|------|
| **D1** | ⚠️ | `app.css:2697-2704` · `WorkCard.tsx:398-403,499-518` | **CSS:** bug de colapso resuelto (`display: block; overflow: visible`). **Lógica:** `isEnriched` oculta tiles FWCI/Citas y chips ODS/SJR si la obra no tiene `autores_uta`, `qi`, `impact`, `fwci` ni `sdgs`. Obras “lite” muestran título, autores, meta, OA y acciones, pero no tiles (`WorkCard.test.tsx:291-309`). |
| **D2** | ✅ | `app.css:2697-2721` · `WorkCard.tsx:446-454` | Card `#fff`, borde `var(--cel-borde)`. Título enlaza DOI con `var(--cel-principal)`. |
| **D3** | ⚠️ | `app.css:2752-2755` · `WorkCard.tsx:499-517` | Estilos celeste correctos cuando `isEnriched`. Tiles no se renderizan en modo lite (ver D1). |
| **D4** | ✅ | `app.css:2790-2799` · `WorkCard.tsx:523-532` | SJR·Qx celeste; `Acceso abierto` solo si `w.oa === true` con `var(--ok-bg)`/`var(--ok-text)`. |

## E) Servicios preservados

| ID | Estado | Evidencia | Nota |
|----|--------|-----------|------|
| **E1** | ✅ | `WorkCitationPanel.tsx:22-28` · `WorkCard.tsx:540` | “Citar” abre panel con APA7, IEEE, Vancouver, BibTeX, RIS. |
| **E2** | ✅ | `WorkCard.tsx:423-427,541-548` | “Acceder” abre DOI/landing vía `normDoi(w.d)`. |
| **E3** | ✅ | `WorkCard.tsx:470-481` · `utaAuthorLinks.ts:75-99` | “Ver ficha” solo con match `autores_uta` por `author_index` + nombre + `author.id` (+ ORCID), sin fuzzy. |
| **E4** | ✅ | `WorkCard.tsx:36-54,534-536` | `SdgChip` usa `ODS_COLORS` y `Link to={/ods/N}`. Colores ONU intactos. |
| **E5** | ✅ | `WorkCard.test.tsx:306` | Chip “Acceso UTA” ausente; test explícito. |

## F) KPIs clickeables

| ID | Estado | Evidencia | Nota |
|----|--------|-----------|------|
| **F1** | ⚠️ | `coAuthorDatasetsCount.ts:63-84` · `CoAuthorModal.tsx:89-91,174-180` · `app.css:2502-2508` | Conteo OpenAlex `type=dataset` vía `meta.count`; muestra 0. Chevron CSS triangle con `var(--cel-principal)`, no clase `ti-chevron-down`. Solo visible si `expandable` (count > 0). |
| **F2** | ✅ | `CoAuthorModal.tsx:105-129,337-361` | Click expande panel inline; fetch en vivo `fetchCoAuthorDatasetRecords`; render `WorkCard variant="dataset"`. |
| **F3** | ⚠️ | `CoAuthorModal.tsx:131-136,363-385` · `utaAuthorLinks.ts:43-61` | Panel UTA con `ResearcherProfileCard`; RUT desde `autores_uta`. Abre ficha vía `openLocalResearcherProfile` (no `<Link>`); URL `/perfiles/...` solo si `shouldSyncProfileRoute` (`useOpenResearcherProfile.ts:27-28`). |
| **F4** | ✅ | `CoAuthorModal.tsx:48-49,316-318` | `datasetsExpanded` y `utaExpanded` son estados independientes. |

## G) Dataset card — tiles DataCite

| ID | Estado | Evidencia | Nota |
|----|--------|-----------|------|
| **G1** | ✅ | `src/utils/datasetUsage.ts:25-60` | `fetchDataCiteUsage` + `clearDataCiteUsageCache` implementados. |
| **G2** | ✅ | `WorkCard.tsx:577-591,711-732` | Vistas/Descargas solo si `> 0`; Citas de OpenAlex (`datasetCitations`) sin cambios. |
| **G3** | ✅ | búsqueda en repo | Sin llamadas a `stats.figshare.com` ni `api.figshare.com` (solo DOIs de ejemplo en tests/datos). |

## H) Alcance

| ID | Estado | Evidencia | Nota |
|----|--------|-----------|------|
| **H1** | ✅ | `app.css:2285-2294` | Tokens `--cel-*` solo bajo `.coauthor-modal`. No aparecen en `:root`. |
| **H2** | ✅ | búsqueda `--cel-` / `#087EA4` | Celeste limitado al bloque coauthor en `app.css`. `ODS_COLORS` en `WorkCard.tsx:36-54` sin cambios. `.coauthor-chip` (`2844+`) se usa en `ResearcherModal.tsx:683` con grises propios, no celeste. |

## I) Tests

| ID | Estado | Evidencia | Nota |
|----|--------|-----------|------|
| **I1** | ✅ | `npm test` (2026-06-10) | **48** archivos, **282** tests, todos verdes. |
| **I2** | ✅ | `src/utils/datasetUsage.test.ts` (7) · `src/components/cards/WorkCard.dataset.test.tsx` (6) | Ambos presentes y pasando. |

---

## Punch list (solo ❌ / ⚠️)

1. **C5 / KPI FWCI** — En el grid de métricas del autor, FWCI no elegible se omite en lugar de mostrar `—` con `fwciIsEligible` (`coAuthorProfileView.ts:211-218`).
2. **D1 / D3 — Card “lite”** — Obras sin enriquecimiento local no muestran tiles Citas/FWCI aunque tengan `c` o DOI (`WorkCard.tsx:398-403,499-518`). CSS de colapso corregido; gate lógico persiste.
3. **A2 — Hex sueltos** — Sustituir `#78909d` por `var(--cel-muted)` en meta de card coauthor (`app.css:2742,2759`). Evaluar uso de `--cel-cian` o eliminar token muerto.
4. **F1 — Chevron** — Implementación CSS triangle en lugar de `ti-chevron-down` (`app.css:2502-2508`); funcional pero no coincide con spec literal.
5. **F3 — Navegación UTA** — Panel coautores abre ficha por estado UI; sincronización de URL a `/perfiles/<id>` condicionada a ruta actual (`useOpenResearcherProfile.ts:27-28`), no link directo siempre visible.

---

*Auditoría generada en modo solo lectura.*
