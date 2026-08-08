# Phase 0 — Vertical-Slice Spec: `io_snapshot` + Q1 (v0.2, engineering)

*Downstream of sealed protocol `Paper3_Feasibility_Audit_Protocol_v1.1.md` (SHA-256 `871b75fe47dd45d4a7249681996e178f4cf51acbcb8d345433fdfb729a53fdb8`). Implementation specification only — does **not** amend the protocol, H1–H4, Tests E–I, or the sealed permitted-output list.*

**Supersedes v0.1 substrate choice.** v0.1 left open a sources-only shakedown; **v0.2 locks the vertical-slice substrate to a one-partition OpenAlex WORKS pilot.**

---

## 0. Purpose

Validate end-to-end plumbing:

pinned OpenAlex WORKS object → Docker acquisition runtime → slim extract → persistent bootstrap parquet → SHA-256 → `io_snapshot` → Q1 → sanctioned writers → grain guard → firewall CI → pilot report.

> **The one-partition pilot validates infrastructure only. It does not constitute the Paper 3 longitudinal universe and cannot be used to select analytical windows, thresholds, lags, journals, disciplines, or hypotheses.**

Mark all pilot products with `PILOT_INFRASTRUCTURE_ONLY = true` in the acquisition report.

---

## 1. Substrate (v0.2)

| Item | Value |
|---|---|
| Substrate | **one** deterministically selected real OpenAlex WORKS parquet object |
| Manifest | `s3://openalex/data/parquet/works/manifest.json` pinned locally |
| Manifest date | `2026-06-26` (RELEASE_NOTES tag `2026-06-25`) |
| Selection rule | lexicographic order of object keys; take first readable key; no content-based choice |
| Horizon filter | `publication_year ∈ [2000, 2026]` (acquisition envelope, not study span) |
| Not used | `cris_victoria.works` (institutional CRIS only) |
| Not used | full WORKS scan (~675 GiB / 2446 objects) |

---

## 2. Layout

```
data/paper3/bootstrap/     # technical inputs + pilot reports (NOT feasibility/out)
feasibility/out/           # allowlisted aggregates only (e.g. q1_coverage_by_year.csv)
feasibility/tmp_restricted/
docker/paper3-acquisition/ # acquisition runtime (Dockerfile + pinned deps)
```

Per-work slim rows may exist **only** under `data/paper3/bootstrap/`. They must **never** appear in `feasibility/out/`.

---

## 3. `io_snapshot` contract (pilot)

- `SnapshotConfig` pinned: `snapshot_date`, `taxonomy_version`, `subfield_vocabulary_sha256`, `source_name`.
- Pilot reader loads `data/paper3/bootstrap/works_slim_pilot.parquet` after hash verify against the pilot input manifest.
- Exposes `works_availability()` as per-work **flags/counts only** (no topic values, no abstract text, no reference lists).
- Q1 aggregates by `publication_year` only.

---

## 4. Q1 (infrastructure exercise)

Emit `q1_coverage_by_year.csv` via `writers.write_permitted` with protocol columns:

`publication_year`, `n_works`, `share_with_venue_id`, `share_with_subfield`, `share_with_abstract`, `share_with_references`, `median_references_per_work`.

Shares to 6 decimal places; CSV UTF-8 `\n`; fixed column order.

**Pilot results must not inform start year, span, window, min_docs, lags, universe, or hypotheses.**

---

## 5. Acceptance (pilot)

1. Deterministic object selection recorded.  
2. Docker image versioned (tag + id/digest).  
3. Slim extract + schema allowlist.  
4. No prohibited outcomes.  
5. `io_snapshot` accepts bootstrap.  
6. Q1 end-to-end via sanctioned writer.  
7. Grain guard rejects per-work leakage into `out/`.  
8. `tmp_restricted` empty (aside from `.gitignore`).  
9. Firewall CI PASS.  
10. Two-run SHA compare for `works_slim_pilot.parquet`.  
11. Full WORKS scan **not** started.

---

## 6. Explicit non-decisions

Same as protocol Phase 0: no universe, windows, thresholds, lags, H1–H4, Tests E–I, coupling, or design selection from pilot numbers.
