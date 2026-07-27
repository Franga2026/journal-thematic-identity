# RELEASE — `release-qss-v1`

**Decisión (coautoría):** el artículo queda **cerrado científicamente**. A partir de este punto opera como una rama *release*: solo correcciones (erratas, cifras, estilo, formato), **ningún cambio conceptual**. Toda idea nueva se registra en `ideas_paper2_parking.md`, nunca en el manuscrito.

Objetivo del artículo (paper 1): *¿Puede inferirse la identidad temática de una revista desde su representación observada, sin confundir observación con inferencia?* Tesis y aporte central — el **observation–inference separation principle** — cerrados de principio a fin.

---

## Congelado (no se toca)

| Componente | Estado |
|---|---|
| Tesis y pregunta de investigación | 🔒 congelado |
| Marco conceptual + Principle 1 | 🔒 congelado |
| Descriptores, definiciones, umbrales | 🔒 congelado |
| Decisiones preregistradas (A′, p_doc, rejilla) | 🔒 congelado |
| Resultados (§6) | 🔒 congelados — **solo se verifican contra manifiestos**, no se recalculan |
| Referencias | 🔒 verificadas contra Crossref (sin `[verify]`) |

**Regla de oro:** si aparece una idea metodológica nueva → va al parking de paper 2. No al paper 1.

---

## Fase 1 — Producción editorial

| Tarea | Estado | Depende de |
|---|---|---|
| Referencias verificadas (Crossref) | ✅ hecho | — |
| Consistencia terminológica (representation/identity/observation/inference) | ✅ hecho | — |
| **Figura 1** — arquitectura del principio | ✅ producida (PDF vector) | — |
| **Figura 2** — construcción de la cohorte | ✅ producida (PDF vector) | cifras §5 (ya en texto) |
| **Figura 5** — replicación insignia | ✅ producida y refinada (PDF vector) | — |
| **Figura 3** — tipología M×D + discriminante | ⬜ pendiente | **manifiesto**: conteos por celda 2×2 + R² del discriminante |
| **Figura 4** — distribución de estabilidad S + robustez | ⬜ pendiente | **manifiesto**: distribución de S (N=511), checks backward/taxonómico |
| Verificación numérica §6 vs manifiestos congelados | ⬜ pendiente | **repo** (tarea del autor) |
| Completar `⟦…⟧` del Supplementary | ⬜ pendiente | **manifiesto**: hashes del paquete de pre-registro, hash p_cit, tolerancia de floats, URL del repo, DOI Zenodo |
| Depósito Zenodo (código, manifiestos, pre-registros, auditoría, hashes) | ⬜ pendiente | **repo** |
| "Data and code availability" (texto final) | ⬜ pendiente | DOI Zenodo |
| Pase de estilo APA / formato QSS | ✅ hecho | — |
| Lectura final completa en PDF | ⬜ pendiente | todo lo anterior |

**Autónomo (sin tu repo):** solo queda el pase APA/QSS. Las Figuras 3–4, la verificación de §6 y los `⟦…⟧` **requieren cifras de tus manifiestos congelados** — no las invento (ver contrato de datos abajo).

### Contrato de datos para cerrar Figuras 3–4 y el Supplementary
Para renderizar sin fabricar resultados, necesito de los manifiestos:
- **Figura 3:** número de revistas en cada una de las 4 celdas de la tipología M×D (o los vectores M y D del cohorte comparable, N=521), y el R² exacto del discriminante de alignment (§6.2 hoy dice ≈0.40–0.50).
- **Figura 4:** el vector (o histograma) de estabilidad S sobre el cohorte (N=511), la mediana (0.783), y los valores de los checks backward/taxonómico que quieras anotar.
- **Supplementary `⟦…⟧`:** hash del paquete de pre-registro, hash del manifiesto p_cit, tolerancia de floats, URL del repo, DOI de Zenodo.

---

## Fase 2 — Pre-envío

| Ítem | Estado | Nota |
|---|---|---|
| Cover letter | ⬜ | puedo redactarla cuando quieras |
| Highlights (si el sistema los pide) | ⬜ | — |
| Suggested reviewers | ⬜ | candidatos naturales: perfil scientometría/clasificación/OpenAlex |
| Opposed reviewers (si corresponde) | ⬜ | — |
| ORCID | ✅ | 0000-0002-6512-8924 |
| Metadata del envío (título, abstract ~200w, keywords, CRediT) | ⬜ | abstract y keywords ya en el manuscrito |

## Fase 3 — Envío
Quantitative Science Studies (MIT Press · Fair Open Access · open peer review · CRediT · data/code obligatorios). Sin reescribir el manuscrito.

## Fase 4 — Respuesta a revisores (previsión)
Preguntas esperadas (de *extensión*, no de consistencia): otra taxonomía · revistas muy interdisciplinarias · revistas pequeñas · extensión a otras entidades. La mayoría ya tiene respuesta parcial en el texto (eje B taxonómico; §8 limitaciones; conclusión sobre generalización). El test discriminante (null model + direccionalidad) está especificado y **diferido a propósito** → es el núcleo del paper 2.
