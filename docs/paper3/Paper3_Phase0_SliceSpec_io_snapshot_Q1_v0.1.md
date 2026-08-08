# Phase 0 — Vertical-Slice Spec: `io_snapshot` binding + Q1 end-to-end (v0.1, engineering)

*Downstream of the sealed protocol `Paper3_Feasibility_Audit_Protocol_v1.1.md` (SHA-256 `871b75fe…fdb8`). This is an **implementation specification**, not a sealed artifact: it does not alter the protocol. It describes how the first production slice — snapshot binding and Q1 — is built, kept outcome-blind, hashed, logged, and made byte-reproducible, before any code is written.*

---

## 0. Purpose and scope of the slice

Build **one** question (Q1 — temporal comparability of coverage) end-to-end on the real snapshot, so that every cross-cutting concern — binding, hash verification, logging, permitted-write, LDAM emission, byte-reproducibility — is exercised and de-risked *before* Q2–Q10 are written. Q1 is chosen because it is conceptually the simplest question and the most purely marginal: per publication year, availability shares only. No journal-level quantity, no identity, no position, no cross-year comparison of anything. The slice is a plumbing shakedown with a genuine, publishable Q1 output as its by-product.

Explicitly **out of scope** for the slice: Q2 survival, any panel construction, any grid sweep beyond the single coverage floor, and — per the firewall — anything I(j,t)/P(j,t).

---

## 1. Substrate finding and the one open decision (D-1)

**What is materialized today.** The OpenAlex **`sources`** partition (parquet, ~162 MiB) loaded into Postgres (`load_openalex_sources.py` → table `openalex_sources`): the world's ~283k journals with `counts_by_year`, `topics`, ISSN. This is a **per-venue** object.

**What Q1 as written in the protocol needs.** Per-**work** availability: total works/year, and the share of works carrying a venue id, ≥1 subfield, an abstract, and references, plus median references/work. Abstract-presence and reference-presence are per-work facts that live in the OpenAlex **`works`** partition (~746 GB, **not** materialized).

**Consequence.** Of the seven Q1 columns, only `publication_year` and `n_works` (via summed `counts_by_year`) are constructible from `sources`; the coverage shares and `median_references_per_work` require `works`. This is a real, outcome-blind data-availability fact — precisely what Phase 0 exists to record (protocol §6 deliverable 3: "naming what is not obtainable").

**Decision D-1 (needs your call — see the question at the end).**

- **Option A — Pipeline-shakedown slice on `sources` now.** Compute the constructible part of Q1 (`publication_year`, `n_works` from `counts_by_year`, plus venue-level presence of ISSN/topics/counts as auxiliary availability), label the per-work columns *unconstructible-from-current-substrate*, and record them as named data requirements in the checklist. Fully exercises binding/hash/log/write/repro. Fast, reproducible, zero large download. Its Q1 is honest but partial.
- **Option B — Materialize a bounded `works` subset first, then run the true per-work Q1.** Pull a pinned, bounded slice of the `works` partition (e.g. a fixed set of years, or a venue sample), hash it into the binding, and compute the full seven-column Q1. Higher fidelity to the protocol's Q1; costs a data-acquisition + storage + pinning step.
- **Option C — Spec both; implement A now as the shakedown, schedule B as the next milestone.**

**Recommendation:** the slice's *stated purpose* is to shake out plumbing, so **A now, B next (i.e. Option C)** maximizes signal per unit effort: we validate the whole machine this week on data already on disk, and the exact same `io_snapshot` contract (below) serves B unchanged when the `works` substrate is decided. Everything in §2–§6 is written substrate-agnostic for exactly this reason.

---

## 2. `io_snapshot` — the binding contract

### 2.1 Objects

```
SnapshotConfig          # the pinned identity of the snapshot (immutable once set)
  source_name:            str          # "OpenAlex"
  snapshot_date:          str (ISO)    # the OpenAlex release date, e.g. 2025-… 
  taxonomy_version:       str          # OpenAlex topics/subfields taxonomy id in force
  subfield_vocabulary:    FileRef      # the frozen identity coordinate system (path + sha256)
  inputs:                 list[FileRef]# every materialized file the slice reads
  substrate:              str          # {"sources", "works_subset"} — selects the reader
  created_under_protocol: str          # "871b75fe…fdb8" (provenance link, not editable)

FileRef                 # content-addressed reference to one input file
  path:  str
  bytes: int
  sha256: str

SnapshotReader (Protocol)             # substrate-specific, hash-verified on construction
  snapshot_meta() -> dict             # date, taxonomy_version, vocabulary sha256, source
  works_availability(year_range) -> Frame   # PER-WORK availability columns (see 2.3)
  venues() -> Frame                   # per-venue neutral fields (for later questions)
```

Two concrete readers implement `SnapshotReader`:
- `SourcesReader` (substrate=`sources`): `venues()` from `openalex_sources`; `works_availability()` **raises `DataRequirementUnmet`** naming the missing `works` partition, *except* it can synthesize `publication_year`/`n_works` from `counts_by_year` (the constructible subset in Option A).
- `WorksSubsetReader` (substrate=`works_subset`): `works_availability()` fully implemented over the pinned `works` subset (Option B).

### 2.2 `load_snapshot(cfg)` — fail-closed binding

1. Refuse if `cfg` is not fully pinned (`is_pinned()`): every field in §2.1 non-null.
2. **Re-hash every `FileRef`** (`subfield_vocabulary` + each `inputs[i]`) and compare to the pinned `sha256`. Any mismatch → `SnapshotDriftError` (the on-disk snapshot changed under us); abort. This is the guarantee that "feasible span = X" later rests on exactly these bytes.
3. Confirm `taxonomy_version` is singular and matches `subfield_vocabulary`'s embedded version tag (one coordinate system across all years — protocol Q4 precondition, checked here once).
4. Return the substrate-appropriate `SnapshotReader`.

`load_snapshot` reads nothing outcome-bearing; it verifies identity and returns a reader. It never computes a subfield distribution or a position.

### 2.3 `works_availability(year_range)` — the neutral view Q1 consumes

Returns one row **per work** (Option B) or is unavailable (Option A `sources`), with columns — all *presence/counle* facts, never values:

| column | type | meaning |
|---|---|---|
| `publication_year` | int | year |
| `has_venue_id` | bool | non-null host source id |
| `has_subfield` | bool | ≥1 subfield/topic assignment **present** (value not read) |
| `has_abstract` | bool | abstract/inverted-index present |
| `has_references` | bool | `referenced_works_count > 0` |
| `referenced_works_count` | int | count only |

The reader **must not** expose the subfield/topic *values*, the abstract *text*, or the reference *list* to Q1 — only these flags/counts. This keeps the identity coordinate system untouched at the availability layer.

### 2.4 Determinism contract (required for byte-repro)

Every reader guarantees: fixed column order and dtypes; integer years (no floats); deterministic row order irrelevant because Q1 aggregates; no locale-dependent formatting. Aggregation and serialization rules that make the *output* reproducible live in §4.3.

### 2.5 Logging

A structured JSONL run log `out/../logs/phase0_run.jsonl` (outside `out/` so it is not an allowlisted data output) records, per step: step name, wall-clock start/end (stamped by the operator's environment, not fabricated), input row counts, output row counts, and the config hash. Row counts are marginal and permitted. No per-journal or per-work record is logged.

---

## 3. Manifest binding — `snapshot_binding.json`

The binding is the notarized identity of the snapshot, produced **once** before Q1 runs (protocol §10 steps 2–3), then referenced by the LDAM.

```jsonc
{
  "created_under_protocol": { "filename": "Paper3_Feasibility_Audit_Protocol_v1.1.md",
                              "sha256": "871b75fe…fdb8" },
  "source_name": "OpenAlex",
  "snapshot_date": "<ISO date of the release>",
  "taxonomy_version": "<openalex topics/subfields version>",
  "substrate": "sources" | "works_subset",
  "subfield_vocabulary": { "path": "...", "bytes": N, "sha256": "..." },
  "inputs": [ { "path": "data/openalex-snapshot/sources/....parquet",
                "bytes": N, "sha256": "..." }, ... ],
  "tool_versions": { "python": "...", "polars_or_pandas": "...", "duckdb_or_psycopg": "..." }
}
```

Rules: (1) the `works`/`sources` files themselves are **never committed** (too large); only their hashes live here. (2) `snapshot_binding.json` is itself hashed; that hash is recorded in the LDAM (`snapshot.binding_sha256`), so the chain protocol → binding → code → outputs is unbroken. (3) The binding is created by a small `bind_snapshot.py` (not part of the firewall-scanned question modules; it only reads + hashes + writes the binding JSON via the sanctioned writer path).

---

## 4. Q1 — exact specification

### 4.1 Population and range

- **Population:** the document-type filter of Papers 1–2 (articles + reviews). Recorded in the log; not a tunable in the slice.
- **Year range:** `[COVERAGE_FLOOR_YEAR (=2000) … snapshot_max_year]`, where `snapshot_max_year` is derived from the data, not hard-coded. Q1 does **not** trim recent years for maturation — it *reports* every year so Q5 can later see immaturity. (The effective-end-year decision is deferred, protocol §5.)

### 4.2 Columns (schema `q1_coverage_by_year.csv`) — exact semantics

| column | definition | null policy |
|---|---|---|
| `publication_year` | int, one row per year in range | — |
| `n_works` | count of population works in that year | 0 if none |
| `share_with_venue_id` | mean(`has_venue_id`) | NaN→treated as 0 presence |
| `share_with_subfield` | mean(`has_subfield`) | idem |
| `share_with_abstract` | mean(`has_abstract`) | idem |
| `share_with_references` | mean(`has_references`) | idem |
| `median_references_per_work` | median(`referenced_works_count`) | 0-count works included |

Under **Option A** (`sources` substrate), the four `share_*` columns and `median_references_per_work` are emitted as the sentinel `NA` with a companion column `constructible=false` for those fields, and the reason is written to the data-requirements checklist. `publication_year` and `n_works` are real.

### 4.3 Reproducibility (byte-exact)

- Shares rounded to **6 decimals**, `round(x, 6)`, banker's rounding disabled (use fixed formatting).
- CSV: UTF-8, `\n` line endings, no index, fixed column order = the schema above, floats formatted with `%.6f`, integers bare, `NA` literal for sentinels.
- **Acceptance test:** run the slice twice from the same binding → the two `q1_coverage_by_year.csv` files have **identical SHA-256**. This is the slice's core reproducibility gate.

### 4.4 Flow (end-to-end)

```
firewall CI (must PASS)  →  load_snapshot(cfg)  [hash-verified]
   →  coverage.q1_coverage_by_year(reader)      [marginal only]
   →  writers.write_permitted(df, "q1_coverage_by_year.csv")   [allowlist + grain + column + series guards]
   →  ldam.write_ldam(cfg): protocol hash first; snapshot block filled;
        executing_code now includes coverage.py hash; records Q1 output sha256
   →  purge tmp_restricted (none for Q1) + assert_restricted_purged
```

### 4.5 Outcome-blind proof obligations (must all hold)

1. Q1 reads only `works_availability` flags/counts — never subfield values, abstract text, or reference lists.
2. No column crosses a journal id with time (grain guard already enforces).
3. No cross-year *difference*, ratio-of-change, or ordering of identity is computed — Q1 emits levels per year, nothing relational.
4. Output passes all four `write_permitted` guards and the static firewall CI.

---

## 5. Definition of done (slice acceptance)

1. `firewall CI` PASS (already green; re-run after adding `coverage.py` body).
2. `load_snapshot` verifies every input hash and **fails closed** on a tampered byte (negative test: flip one byte → `SnapshotDriftError`).
3. `q1_coverage_by_year.csv` produced with the exact §4.2 schema.
4. **Byte-repro:** two runs → identical SHA-256 (§4.3).
5. LDAM emitted: `authorizing_protocol.sha256 == 871b75fe…`; `snapshot.binding_sha256` present; `executing_code` includes `coverage.py`; `produced_outputs` records the Q1 CSV hash.
6. `out/` allowlist clean; `tmp_restricted/` purged; no prohibited output.
7. Data-requirements checklist updated: which Q1 fields were constructible on this substrate, which are pending `works` (Option A) — or all seven present (Option B).

---

## 6. What this slice deliberately does **not** decide

Start year, window length, min_docs, panels, effective end year, any Q2–Q10 quantity, and — absolutely — anything about coupling, drift, persistence, or the H1–H4 outcomes. The slice proves the *machine*; the questions it will later carry remain, by construction, blind to the result Paper 3 seeks.

---

## 7. Open decision to confirm before coding

**D-1:** substrate for the slice — **A** (`sources` shakedown now), **B** (materialize a `works` subset first), or **C** (A now, B next). Recommendation: **C**. Once you pick, I write `bind_snapshot.py` + the `coverage.q1_coverage_by_year` body + the two acceptance tests (hash fail-closed, byte-repro), and run the slice.
