# Changelog

All notable changes to this scientific package are documented here. Versioning is manuscript-level (not semantic).

## [1.0] — 2026-07-29
### Submitted to Quantitative Science Studies
- First public release of the curated scientific package, corresponding to the submitted manuscript.
- Manuscript (`preprint.pdf`) and Supplementary Material (`supplementary.pdf`) included; the discriminant is reported as the executed model (`JCA ~ |E| + log N + H`, R² = 0.395; `JCA ~ |E| + log N + TCI`, R² = 0.496).
- Canonical analysis code curated to the minimal set that reproduces the reported quantities, sanitized for public distribution (credentials removed; DSN read from `CRIS_DB_DSN`). See `VERSION.md` for frozen-vs-public SHA-256 provenance.
- Frozen analysis outputs, run manifests, six preregistration documents, and the code-to-documentation audit evidence (including the SHA-256 catalog) included under `data/`.
- Five figures (vector) under `figures/`.
- Reproducible package also archived at Zenodo: https://doi.org/10.5281/zenodo.21659764.

*(Future entries: reviewer-revision versions will be added here as v1.1, v2.0, etc., each with its own Zenodo version.)*
