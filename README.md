# Reconstructing Journal Thematic Identity from Article-Level Topics
### A Reproducible Framework and a Preregistered Temporal Validation

**Author:** Francisco Javier Garrido Valdés · RosFlo Limitada, Santiago, Chile · ORCID [0000-0002-6512-8924](https://orcid.org/0000-0002-6512-8924)

**Preprint:** Zenodo v1.0.1 — [https://doi.org/10.5281/zenodo.21659764](https://doi.org/10.5281/zenodo.21659764) (immutable; GitHub tag `preprint-v1.0.1`).  
**Journal submission:** *Quantitative Science Studies* (MIT Press / ScholarOne) — Manuscript ID `QSS-2026-0145`, submitted 2026-07-31. Exact submitted files: `submission-qss/` (git tag `submitted-qss`). Peer review pending.

---

This repository is the curated scientific package for the manuscript above: the manuscript, the canonical analysis code, the frozen analysis outputs, the data manifests, the preregistration documents, and the audit artifacts used to verify the reported results. It contains **only** the material needed to understand and verify the article — no application code, deployment configuration, or credentials. The same package will be archived at Zenodo once the deposit is published.

## What this work is
A methodological framework for reconstructing a journal's thematic identity from the topics of its articles, organized around a single principle — **a representation is observed; an identity is inferred** (the *observation–inference separation principle*). The framework is submitted to a preregistered temporal replication and a documentary control, with all thresholds fixed in advance and the outcome reported exactly as the preregistered rule returns it, including where it is inconclusive.

## Repository layout
```
journal-thematic-identity/
├── README.md
├── LICENSE                     CC BY 4.0 (manuscript, figures, data)
├── CITATION.cff
├── CHANGELOG.md
├── VERSION.md                  version register: frozen vs public SHA-256, derivations
├── manuscript/                 immutable preprint package (Zenodo v1.0.1)
│   ├── preprint.pdf
│   ├── supplementary.pdf
│   ├── preprint.md
│   └── supplementary.md
├── submission-qss/             exact QSS ScholarOne upload (2026-07-31)
│   ├── README.md               milestone record (QSS-2026-0145)
│   ├── manuscript.pdf
│   ├── supplementary.pdf
│   └── cover_letter.pdf
├── code/                       canonical analysis (sanitized) + MIT LICENSE + README
├── data/
│   ├── manifests/              run manifests + frozen result tables
│   ├── preregistration/        preregistered protocols (fixed in advance)
│   └── audit/                  code-to-documentation audit evidence + hash catalog
└── figures/                    figure1.pdf … figure5.pdf (vector)
```

## Reproducibility
The repository provides the canonical analysis code, the frozen analysis outputs, the manifests, the preregistrations, and the audit artifacts used to verify the reported results. **Verifiable reproduction** of the article rests on these frozen outputs, the manifests, the SHA-256 catalog, the preregistrations, the audit evidence, and the documented code-to-result correspondence (see `code/README.md` and `VERSION.md`).

**Full re-execution from the source database is an additional level**, conditional on having an equivalent PostgreSQL materialization of the underlying OpenAlex data: the analysis scripts read their input from a PostgreSQL database whose DSN is supplied through the `CRIS_DB_DSN` environment variable. Cloning this repository is therefore sufficient to *verify* every reported quantity against the frozen artifacts, but not, on its own, to *recompute* them from raw data without that materialization.

The same package will be archived at Zenodo under the reserved DOI once the deposit is published. Every reported quantity traces to the exact implementation that produced it through a SHA-256 version identifier. Because the public code was sanitized (credentials removed, DSN read from the environment), `VERSION.md` records, for each file, both the **frozen** source hash (as executed for the paper, verified against the audit catalog where the file is registered there) and the **public** sanitized hash, together with the transformation applied and a confirmation that no analytical logic was modified.

## How to cite
See `CITATION.cff`. In brief:

> Garrido Valdés, F. (2026). *Reconstructing Journal Thematic Identity from Article-Level Topics: A Reproducible Framework and a Preregistered Temporal Validation* (Preprint v1.0). Zenodo. https://doi.org/10.5281/zenodo.21659764

## License
The manuscript, figures, and data in this repository are released under **CC BY 4.0** (`LICENSE`). The analysis code under `code/` is released under the **MIT License** (`code/LICENSE`).

## Status
- Preprint package: Zenodo v1.0.1 (immutable).
- Journal: submitted to *Quantitative Science Studies* as `QSS-2026-0145` on 2026-07-31 (see `submission-qss/`). Peer review pending.
