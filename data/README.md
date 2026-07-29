# Data, manifests, preregistrations, and audit

This directory holds the frozen artifacts on which verifiable reproduction of the article rests. Nothing here was produced by transcribing numbers from the manuscript; the manuscript reports numbers extracted from these artifacts.

## `manifests/`
Run manifests and frozen result tables emitted by the analysis code — the exact inputs and outputs behind the reported quantities. Includes the A′ replication manifests (document- and citation-weighted), the common-panel analysis, the discriminant results, the per-journal result tables, and the figure data (Figure 3/4).

## `preregistration/`
The six preregistration documents. Metrics, reference values, decision thresholds, and verdict rules were fixed in advance in these protocols, before the corresponding analyses were executed:
`preregistro_pruebaA_prima.md` (temporal replication), `preregistro_pruebaB.md` (taxonomic robustness), `preregistro_pruebaC.md` (snapshot robustness), `preregistro_discriminante.md` (JCA discriminant), `preregistro_S_pdoc.md` (documentary control), `preregistro_MD_cobertura_completa.md` (coverage/position descriptors).

## `audit/`
Code-to-documentation audit evidence: frozen extracts (`r2_models_exact.json`, `stability_extract.json`, `typology_from_md_intrinsecos.json`, `cohort_query_dump.json`, `backward_metrics_raw.json`, `ref_a_empirical_trail.json`), re-run logs, the numerical verification matrix (`matriz_verificacion_numerica.md`), the final audit report, and the **SHA-256 catalog** (`sha256_catalog.json`) that registers the frozen artifacts. The catalog is preserved verbatim; see `../VERSION.md` for how the public copies relate to it.

*Some audit logs and two manifests were redacted only to remove absolute local filesystem paths (no data value was changed); the frozen-vs-public hashes are recorded in `../VERSION.md`.*
