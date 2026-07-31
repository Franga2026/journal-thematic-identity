# Changelog

All notable changes to this scientific package are documented here. Versioning is manuscript-level (not semantic).

## [submitted-qss] — 2026-07-31
### QSS journal submission (ScholarOne `QSS-2026-0145`)
- Added `submission-qss/` with the exact byte-identical PDFs uploaded to ScholarOne on 2026-07-31 (`manuscript.pdf`, `supplementary.pdf`, `cover_letter.pdf`) and the milestone record as `README.md`.
- SHA-256 verified: manuscript `5d60e353…`, supplementary `56b0d92c…`, cover letter `81efa2c8…`.
- Preprint package under `manuscript/` and tags `preprint-v1.0` / `preprint-v1.0.1` remain **immutable**; the submitted version differs by editorial author revisions documented in `submission-qss/README.md` (not a scientific re-analysis).
- Git tag `submitted-qss` marks this commit.

## [1.0.1] — 2026-07-29
### Editorial correction (package artifact only; no scientific change)
- Supplementary §S6: changed "Archived deposit (Zenodo)" to "Reserved Zenodo deposit (DOI reserved; record becomes public upon publication)", consistent with the deposit not yet being published.
- Removed a stale internal draft footer from the Supplementary ("Draft v1 … remaining placeholders … pending deposit").
- Fixed a filename reference in the Supplementary: `VERSIONS.md` → `VERSION.md`.
- Supplementary §S6 reproduction procedure: "archived snapshot" → "frozen input snapshot", consistent with the not-yet-published deposit.
- No change to any number, figure, code, datum, or the manuscript text. The manuscript version is unchanged (v1.0); this release corrects the public package artifact only.

## [1.0] — 2026-07-29
### Preprint v1.0 — prepared for submission to Quantitative Science Studies
- First public release of the curated scientific package, corresponding to the preprint manuscript (not yet peer reviewed).
- Manuscript (`preprint.pdf`) and Supplementary Material (`supplementary.pdf`) included; the discriminant is reported as the executed model (`JCA ~ |E| + log N + H`, R² = 0.395; `JCA ~ |E| + log N + TCI`, R² = 0.496).
- Canonical analysis code curated to the minimal set that reproduces the reported quantities, sanitized for public distribution (credentials removed; DSN read from `CRIS_DB_DSN`). See `VERSION.md` for frozen-vs-public SHA-256 provenance.
- Frozen analysis outputs, run manifests, six preregistration documents, and the code-to-documentation audit evidence (including the SHA-256 catalog) included under `data/`.
- Five figures (vector) under `figures/`.
- A Zenodo DOI has been reserved for the reproducible package (https://doi.org/10.5281/zenodo.21659764); the public record will become available upon publication of the deposit.

*(Future entries: reviewer-revision versions will be added here as v1.1, v2.0, etc., each with its own Zenodo version.)*
