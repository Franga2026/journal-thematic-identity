# Canonical analysis code

This directory contains the **minimal canonical set** of scripts required to reproduce the quantities reported in the manuscript and Supplementary Material. It is a curated scientific edition, not a dump of the development tree: exploratory scripts, debugging utilities, alternative versions of the same analysis, and all application code have been left out. Every script here contributes directly to a published result.

## Script → result correspondence

| File | Frozen source | Produces (manuscript) |
|---|---|---|
| `01_compute_descriptors.py` | `md_intrinsecos.py` | Intrinsic descriptors M (coverage) and D (position); the coverage×position typology — §4, §6, Figure 3(a) |
| `02_discriminant_analysis.py` | `jca_discriminant_validity.py` | Discriminant validity of alignment (JCA): `JCA ~ \|E\| + logN + H` (R² = 0.395) and `JCA ~ \|E\| + logN + TCI` (R² = 0.496), OLS N = 521 — §6.2, Figure 3(b) |
| `03_temporal_replication.py` | `prueba_A_prima.py` | Preregistered prospective temporal replication (Prueba A′), forward window shift — §6.4, Figure 5 |
| `04_documentary_control.py` | `recompute_S_pdoc.py` | Documentary control: stability S recomputed on document-weighted (p_doc) distributions — §6.4, Figure 5 |
| `05_taxonomic_robustness.py` | `pruebaB_taxonomica.py` | Taxonomic robustness of the observed representation (subfield → field) — Supplementary |
| `06_snapshot_robustness.py` | `pruebaC_snapshot.py` | Reproducibility of the profile under snapshot perturbation (Prueba C) — Supplementary |
| `db.py` | `db.py` | Shared PostgreSQL connection helper (sanitized) |

Suggested execution order follows the numbering: descriptors → discriminant → temporal replication → documentary control → robustness checks. Scripts `02` and `04` import the shared DSN from `db.py`.

## Data dependency and how to run

These scripts read their input from a **PostgreSQL** database materialized from OpenAlex data; they are not standalone. Provide the connection string through the environment — no credential is stored in the code:

```bash
export CRIS_DB_DSN="postgresql://USER:PASSWORD@HOST:5432/DBNAME"
pip install -r requirements.txt
python 03_temporal_replication.py
```

If `CRIS_DB_DSN` is not set, the scripts stop with an explicit error rather than falling back to any default.

Because a reader will not generally have the source database, **verifiable reproduction** of the paper rests on the frozen outputs and manifests in `../data/` and the audit evidence in `../data/audit/` (see `../VERSION.md`), not on re-executing these scripts. Full re-execution is an additional level, conditional on an equivalent OpenAlex materialization.

## Provenance and integrity
Each file here is a **sanitized public copy** derived from a frozen source that was executed to produce the paper. `../VERSION.md` records, per file, the original (frozen) SHA-256, the public (sanitized) SHA-256, and the exact transformation applied. No analytical logic was modified in any file; the only changes were the removal of hard-coded credentials, standardization of the DSN environment variable, neutralization of a contact placeholder, and renaming for public distribution.

## License
MIT (`LICENSE` in this directory).
