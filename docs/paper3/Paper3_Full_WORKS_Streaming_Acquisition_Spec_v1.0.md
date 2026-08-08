# Paper 3 — Full WORKS Streaming Acquisition Spec v1.0

**Status:** DESIGN-ONLY — freezable engineering specification.  
**Does not amend** sealed `Paper3_Feasibility_Audit_Protocol_v1.1.md`.  
**Does not authorize** starting the full WORKS scan until explicit human approval after seal.

| Field | Value |
|---|---|
| Project | Paper 3 — *Dynamic Coupling Between Journal Thematic Identity and Competitive Position: A Longitudinal Analysis* |
| Spec id | `Paper3_Full_WORKS_Streaming_Acquisition_Spec_v1.0` |
| Governing sealed protocol | `docs/paper3/Paper3_Feasibility_Audit_Protocol_v1.1.md` |
| Protocol SHA-256 | `871b75fe47dd45d4a7249681996e178f4cf51acbcb8d345433fdfb729a53fdb8` |
| Upstream decision record | `docs/paper3/openalex_snapshot_acquisition_decision_v1.0.md` |
| Pilot slice (infrastructure) | `docs/paper3/Paper3_Phase0_SliceSpec_io_snapshot_Q1_v0.2.md` |
| This document role | Normative acquisition architecture for Layer B materialization |

---

## 1. Purpose

This specification defines how Paper 3 will materialize a new dataset:

**Paper 3 Longitudinal Layer B Snapshot**

derived from the pinned OpenAlex WORKS parquet snapshot via streaming extraction.

This dataset:

- is **not** `universe_works.parquet` from Papers 1–2 / Estudio1;
- does **not** attempt to reproduce historical SHA-256  
  `5f4b5dbcf9b2b3d8a21f3e5c6395b57f7aa9378a13771d37d796f79a6f86a223`;
- does **not** inherit the Estudio1 universe of 26 636 journals;
- does **not** condition inclusion on survival in 2021–2025;
- contains **no** Paper 3 scientific outcomes (no I, P, JSD, quartiles, lags, coupling, H1–H4, Tests E–I);
- is the frozen substrate for Phase 0 (Q1–Q10 / LDAM) and, **after** preregistration, for Pipeline B.

The one-partition Q1 vertical slice v0.2 proved infrastructure only. Its Q1 numbers **must not** select start year, span, window length, `min_docs`, lags, journals, disciplines, or hypotheses.

> **This document is DESIGN-ONLY. Full WORKS scan (~675 GiB / 2 446 objects) must not be started under this task.**

---

## 2. Provenance anchors (frozen inputs)

These values were validated by the Q1 vertical slice v0.2 and the acquisition decision record. They are **inputs** to the future production run, not renegotiable by content inspection.

| Anchor | Value |
|---|---|
| OpenAlex parquet `manifest.date` | `2026-06-26` |
| RELEASE_NOTES / release tag | `2026-06-25` |
| WORKS manifest local pin | `data/paper3/bootstrap/works_manifest.pinned.json` |
| WORKS manifest SHA-256 | `4b5142cb47f22fb5f6e91fc330ed800e355e8bb9421b10d812394780b9a1443d` |
| WORKS objects | **2 446** |
| WORKS `record_count` | **510 372 821** |
| WORKS `content_length` | **724 970 323 127** bytes (~675.18 GiB) |
| Partition key | `updated_date` (**not** `publication_year`) |
| S3 bucket | `s3://openalex` |
| WORKS prefix | `s3://openalex/data/parquet/works/` |
| Pilot object (infra only) | `s3://openalex/data/parquet/works/updated_date=2016-06-24/part_0000.parquet` |
| Pilot slim SHA-256 | `7d952e5418e76cbced41042c0e3ce645fd63d652aa611d9289b04842abc92f8d` |
| Docker image (pilot) | `paper3-acquisition:0.2.0` |
| Image digest | `sha256:3a7dbe684a28d1ccb4659ffe5138384960eb234ed8d2f1a03580f3b31cf5e76b` |
| Dockerfile SHA-256 | `b57a5b659a8b8a3b8fe34a47573adeda373fd806ce1e3c203a5716204658e39d` |
| Python / pyarrow / boto3 | 3.12.8 / 19.0.1 / 1.36.16 |
| Firewall at pilot close | **PASS** |
| `prohibited_outcomes_computed` (pilot) | `false` |

**Production image rule.** Before the full scan, either (a) reuse the exact digest above, or (b) seal a new `paper3-acquisition` tag/digest whose Dockerfile+requirements SHAs are recorded in `paper3_full_acquisition_manifest.json` **before** object 0 starts. Mixing digests mid-run is FAIL.

---

## 3. Layer A / Layer B

### 3.1 Layer A — Logical Raw Source Snapshot

Layer A is the **logical frozen source**, not necessarily a full physical copy of ~675 GiB on the laptop volume.

Layer A is fixed by:

1. OpenAlex release notes date (`2026-06-25`);
2. parquet `manifest.date` (`2026-06-26`);
3. WORKS manifest SHA-256 (above);
4. exact ordered list of **2 446** WORKS object keys + per-object `content_length` + `record_count` + any available ETag/checksum metadata;
5. corresponding SOURCES release (same manifest date family);
6. corresponding taxonomy release (topics / subfields / fields / domains).

**Artifact:** `data/paper3/raw_manifests/raw_object_inventory.json`

That inventory **is** the frozen Layer A for WORKS. Optional physical archive of raw parquet objects may live on external disk under `data/paper3/raw_sources/works/` but is **not required** if streaming + per-object SHA-256 of downloaded bytes is recorded.

**Rule:** Never call an S3 ETag “SHA-256 of the remote object.” If a content hash is required, hash the bytes actually read and store it separately (`sha256_of_downloaded_bytes`).

### 3.2 Layer B — Paper 3 Longitudinal Slim Snapshot

Layer B is the **physically persisted** slim dataset under:

`data/paper3/layer_b/`

**Acquisition horizon (filter only):**

```text
publication_year ∈ [2000, 2026]
```

This is the acquisition envelope. It is **not** the definitive analytical span (chosen later by Phase-0 LDAM / decision table).

Layer B must be rebuildable from Layer A + this spec’s SHA-256 + pinned Docker image + extractor code hash.

---

## 4. Object inventory and canonical order

### 4.1 Construction algorithm (deterministic)

```text
1. Load works_manifest.pinned.json
2. Verify SHA-256 == 4b5142cb47f22fb5f6e91fc330ed800e355e8bb9421b10d812394780b9a1443d
3. Extract files[].url where url ends with .parquet
4. Sort URLs lexicographically (Unicode code-point / UTF-8 byte order as Python sorted(str))
5. Assign object_index = 0 .. N-1  (expect N = 2446)
6. Persist raw_object_inventory.json
```

### 4.2 Inventory schema (conceptual)

```json
{
  "inventory_version": "1.0",
  "entity": "works",
  "format": "parquet",
  "manifest_date": "2026-06-26",
  "release_notes_tag": "2026-06-25",
  "works_manifest_sha256": "4b5142cb…",
  "selection_rule": "lexicographic_sort_of_manifest_file_urls",
  "expected_objects": 2446,
  "objects": [
    {
      "object_index": 0,
      "url": "s3://openalex/data/parquet/works/updated_date=…/part_….parquet",
      "key": "data/parquet/works/updated_date=…/part_….parquet",
      "content_length": 0,
      "record_count": 0,
      "etag": null,
      "updated_date_partition": "YYYY-MM-DD"
    }
  ]
}
```

`object_index` governs execution, checkpointing, logs, retry, and provenance.  
**Non-deterministic object order is forbidden.**

---

## 5. Extraction algorithm (per object)

Each object is processed independently. No full 675 GiB materialization is required.

```text
for object_index in 0 .. 2445:
    mark RUNNING
    fetch/stream RAW OBJECT_i  (S3 or local Layer-A archive)
    verify size vs inventory content_length (mismatch → FATAL)
    optionally compute sha256_of_downloaded_bytes
    read parquet columns needed for slim projection
    filter publication_year ∈ [2000, 2026]
    project/derive allowed fields (§6–§7)
    canonical row sort within shard (§11)
    write Stage-1 shard via deterministic writer (§11)
    validate shard (§19)
    update checkpoint → DONE + hashes
    discard raw object bytes from scratch (unless archiving Layer A)
compact Stage-1 → Stage-2 year partitions (§8)
global validate + seal manifests (§12, §20–§21)
```

**Memory rule:** never concatenate all objects in RAM. Scratch buffer ≈ one object (+ compaction window).

**Host independence:** scientific logic must not depend on hostname; paths via env/mounts only.

---

## 6. Slim schema

### 6.1 Class A — Core Phase-0 availability fields

| Column | Type | Source / derivation |
|---|---|---|
| `work_id` | string | `id` |
| `publication_year` | int32 | `publication_year` |
| `source_id` | string nullable | `primary_location.source.id` |
| `work_type` | string nullable | `type` |
| `language` | string nullable | `language` |
| `cited_by_count` | int32 | `cited_by_count` (null→0) |
| `referenced_works_count` | int32 | `referenced_works_count` (null→0) |
| `has_source` | bool | `source_id` non-empty |
| `has_abstract` | bool | `abstract_inverted_index` present/non-empty (**content discarded**) |
| `has_references` | bool | `referenced_works_count > 0` |
| `has_topic` | bool | `primary_topic` present |
| `has_subfield` | bool | primary topic or any `topics[]` yields subfield-capable assignment |

These match the validated pilot columns and are sufficient for Q1 availability margins.

### 6.2 Class B — Raw thematic / bibliographic inputs for post-preregistration Pipeline B (and Phase-0 constructibility)

**Policy:** Store the **minimum** raw inputs needed to build `I(j,t)` **later** without re-reading OpenAlex, but **never** compute journal×window identity during acquisition.

| Column | Type | Rationale |
|---|---|---|
| `primary_topic_id` | string nullable | Stable topic id from `primary_topic.id` |
| `primary_subfield_id` | string nullable | From `primary_topic.subfield.id` (or equivalent nested path) |
| `topic_assignments` | list\<struct\`{topic_id: string, score: float32}\`\> | From `topics[]`; **sorted by `topic_id` ascending**; scores as provided; **no journal aggregation** |
| `counts_by_year` | list\<struct\`{year: int16, cited_by_count: int32}\`\> | Needed for Phase-0 citation-maturation **aggregates** (protocol Q family); sorted by `year` ascending |

**Not stored:**

- full `abstract_inverted_index` text/map;
- full `referenced_works` id arrays (count + `has_references` suffice for Phase 0);
- nested display names for topics (names live in frozen taxonomy);
- author lists, fulltext, abstract mining features.

### 6.3 Class C — Prohibited derived variables (must not appear)

Any of: `I(j,t)`, thematic identity vectors at journal×window grain, identity trajectories, thematic drift, temporal thematic similarity, JSD / Wasserstein / Hellinger / Bhattacharyya / TV / Bray–Curtis / longitudinal cosine, `P(j,t)`, competitive position, journal quartiles / quartile movement / change, longitudinal `pct_change`, autocorrelation, cross-correlation, lags, persistence, susceptibility, coupling, H1–H4, Tests E–I, or any journal×window table that reconstructs trajectories.

### 6.4 Column order (canonical)

Exact writer column order:

1. `work_id`  
2. `publication_year`  
3. `source_id`  
4. `work_type`  
5. `language`  
6. `cited_by_count`  
7. `referenced_works_count`  
8. `has_source`  
9. `has_abstract`  
10. `has_references`  
11. `has_topic`  
12. `has_subfield`  
13. `primary_topic_id`  
14. `primary_subfield_id`  
15. `topic_assignments`  
16. `counts_by_year`

`schema_hash` = SHA-256 of the canonical Arrow schema JSON (field names + types + nullability + nested field order), UTF-8, no volatile metadata.

---

## 7. Thematic raw inputs policy

| Do | Do not |
|---|---|
| Persist work-level topic ids + scores | Build journal thematic share vectors |
| Bind names via `canonical_topic_taxonomy.json` | Embed renaming logic into Layer B rows |
| Keep flags for availability Qs | Inspect topic distributions to choose windows |
| Defer `I(j,t)` to Pipeline B after preregistration | Compute drift / similarity during acquisition |

**Abstracts / references (pilot rule retained):**  
`has_abstract` only; `referenced_works_count` + `has_references` only. No “store just in case” blobs.

---

## 8. Partition / shard strategy (CHOSEN)

### 8.1 Alternatives considered

| Option | Idea | Pros | Cons |
|---|---|---|---|
| **A** | Shard only by `object_index` | Perfect restartability; 1:1 with Layer A | Awkward for Q1–Q10 by year; many files |
| **B** | Write directly by `publication_year` while scanning `updated_date` objects | Nice final layout | Many open writers; fragment explosion; hard atomic restart; duplicate risk across years mid-run |
| **C** | **Two-stage:** Stage-1 object shards → Stage-2 deterministic compaction by `publication_year` | Restartable; hashable; limited memory; clean year layout for Q*; audit-friendly | Extra compaction pass |

### 8.2 Decision: **Option C (two-stage)**

**Stage 1 — object slim shards**

```text
data/paper3/layer_b/shards/stage1/
  object_index=0000/part.parquet
  object_index=0001/part.parquet
  …
  object_index=2445/part.parquet
```

- Exactly one shard file per successful object (even if 0 retained rows — empty table with canonical schema is allowed and hashed).
- Rows sorted by `work_id` ascending (nulls last as empty string key).
- Checkpoint unit = `object_index`.

**Stage 2 — year compaction (after Stage 1 complete OR after verified DONE set)**

```text
data/paper3/layer_b/shards/stage2/
  publication_year=2000/part-00000.parquet
  …
  publication_year=2026/part-00000.parquet
```

Compaction rules:

1. Read Stage-1 shards in ascending `object_index`.
2. Route rows to year buckets.
3. Within each year, sort by `work_id`.
4. Apply duplicate policy (§9) **here** (global uniqueness check).
5. Write deterministic year parquet parts (single part per year unless row-group size forces numbered parts; if multiple parts, name `part-XXXXX` zero-padded and record all in shards manifest).
6. Prefer **one file per year** when feasible; if a year exceeds a configured max rows/bytes, split by contiguous `work_id` ranges with deterministic thresholds recorded in the manifest.

**Why C wins:** reproducibility + restartability + hashability + bounded memory + Q1–Q10 convenience + audit of which object produced which rows via Stage-1 retention until seal (Stage-1 may be deleted only after Stage-2 + manifests verified and optional archival policy).

---

## 9. Duplicate policy

### 9.1 Official OpenAlex expectation

Per OpenAlex snapshot docs: entities are partitioned by `updated_date`; when a record is updated it **moves** to a newer partition. A coherent snapshot whose object list is exactly the pinned manifest’s `files[]` is therefore expected to contain **each `work_id` at most once**.

Duplicates are expected mainly if a local archive mixes generations (e.g. sync without deleting moved partitions). Streaming strictly from the pinned inventory should not produce duplicates.

### 9.2 Paper 3 rules

| Item | Rule |
|---|---|
| Expectation | `work_id` unique across retained Layer B rows |
| Detection | During Stage-2 compaction: streaming uniqueness structure (external sort / hash set of ids) counting collisions |
| Metric | `n_duplicate_work_ids`, `n_duplicate_rows` recorded in acquisition manifest |
| Default action | **STOP / FAIL** if any duplicate `work_id` is detected |
| Silent resolve | **Forbidden** (no silent “keep last”) |
| Optional documented resolve (only if human-approved amendment to this spec before production) | Keep the row from the **higher** `updated_date_partition` (from source object path); ties → higher `object_index`; still record `n_duplicates_resolved` and set `duplicate_resolution = "openalex_upsert_newest_partition"` |

Until an amendment is sealed, **duplicates = FATAL**.

Merged-ids / deleted entities: follow OpenAlex snapshot contents as-is; do not invent survival filters.

---

## 10–11. Deterministic writer

All Layer B parquet writes go through a **sanctioned** writer module (extension of `feasibility/src/writers.py` or `feasibility/src/layer_b_writers.py`), never ad-hoc `df.to_parquet` from ungoverned modules.

### 11.1 Writer options (locked)

| Option | Value |
|---|---|
| Engine | pyarrow **19.0.1** (pinned in Docker image) |
| Compression | `zstd` |
| Compression level | `3` |
| Dictionary encoding | **off** (`use_dictionary=False`) |
| Statistics | **off** (`write_statistics=False`) |
| Data page version | `"1.0"` |
| Store Arrow schema | `true` |
| Row group size | `1_048_576` rows (record constant; do not auto-tune) |
| Column order | §6.4 exactly |
| Row order | `work_id` ascending (string lexicographic) |
| Nested list order | `topic_assignments` by `topic_id`; `counts_by_year` by `year` |
| File metadata | no run timestamps / no hostname / no user keys in parquet KV metadata |
| Created-by / Arrow footer volatility | avoid writing wall-clock into custom metadata |

**Byte identity goal:**

```text
same object bytes + same image digest + same extractor commit/hash + same writer options
  ⇒ same Stage-1 shard SHA-256
```

---

## 12. Hashing

### 12.1 Per-shard record (`layer_b_shards_manifest.json`)

Each shard entry:

| Field | Meaning |
|---|---|
| `shard_id` | e.g. `stage1/object_index=0000` or `stage2/publication_year=2019/part-00000` |
| `stage` | `1` or `2` |
| `source_object_indexes` | list of contributing `object_index` values |
| `publication_year` | int or null (null for Stage-1) |
| `rows` | row count |
| `bytes` | file size |
| `sha256` | file content hash |
| `schema_hash` | §6.4 schema hash |
| `min_publication_year` / `max_publication_year` | from rows |
| `status` | `DONE` / `EMPTY` / `FAILED` |

Canonicalization: JSON with `sort_keys=True`, UTF-8, trailing newline, stable list orders.

**Root hash:**

```text
layer_b_root_sha256 = SHA-256(canonical bytes of layer_b_shards_manifest.json)
```

No Merkle tree required.

### 12.2 Checksums directory

```text
data/paper3/layer_b/checksums/
  stage1.sha256
  stage2.sha256
  layer_b_shards_manifest.sha256
```

---

## 13. Checkpointing

**File:** `data/paper3/layer_b/manifests/checkpoint.jsonl`  
One JSON object per line; last record for an `object_index` wins; or a single JSON map rewritten atomically via temp+rename.

### 13.1 States

`PENDING` → `RUNNING` → `DONE` | `FAILED` → (after hash recheck) `VERIFIED`

### 13.2 DONE payload (minimum)

- `object_index`, `url`, `content_length`, `etag` (if any)
- `sha256_of_downloaded_bytes` (if computed)
- Stage-1 shard path(s), rows, bytes, `sha256`
- `retry_count`
- technical timestamps (`started_at`, `finished_at`) — **not** embedded in parquet

### 13.3 Resume rule

Before skipping a `DONE` object:

1. Stage-1 shard file exists;
2. size matches checkpoint;
3. SHA-256 matches checkpoint;

else downgrade to `PENDING` and reprocess. **Never trust textual state alone.**

---

## 14. Retry policy

| Parameter | Value |
|---|---|
| `max_retries` | 5 per object |
| Backoff | exponential: 5s × 2^attempt (cap 300s) + small deterministic jitter from `object_index` |
| Retryable | S3 timeout, 5xx, connection reset, transient read errors |
| Fatal / STOP | content_length mismatch; schema incompatible; disk full; checksum mismatch after successful download; duplicate policy breach; credential/config error; prohibited outcome detection; firewall FAIL |
| Skip failed | **Forbidden** |

Dataset completeness requires **2446/2446** objects `VERIFIED` (or an explicit inventory amendment sealed before run — not mid-run cherry-picking).

---

## 15. Resource policy

### 15.1 Preflight (must pass before object 0)

1. Compute free bytes on Layer B mount.  
2. Estimate Layer B storage with **conservative** bounds (pilot ratio is **not** trusted alone).  
3. Enforce `minimum_free_space`.

### 15.2 Conservative size model (pre-production)

| Component | Estimate | Notes |
|---|---:|---|
| S3 transfer / read | **~675 GiB** | from pinned `content_length` |
| Scratch (one object) | **≤ 4 GiB** recommended headroom | parts can be ≫ pilot’s 3.6 MiB |
| Stage-1 persistent | **5–80 GiB** (uncertain) | pilot slim ratio ~0.003 was for tiny early part **without** Class B columns |
| Stage-1 + Class B columns | use **upper planning band 40–120 GiB** | topic lists + `counts_by_year` inflate vs pilot |
| Stage-2 | ≈ Stage-1 (replace or dual-hold briefly) | budget **2× Stage-1** during compaction |
| SOURCES + taxonomy | **≪ 1 GiB** | ~162 MiB + ~3 MiB |
| **Recommended free before start** | **≥ 250 GiB** on Layer B volume | stream-only; no full Layer A |
| **If archiving Layer A WORKS** | **≥ 1 TB** external | 675 GiB + Layer B + scratch |

Abort if free < `minimum_free_space` (default **100 GiB** after estimates reserved).

### 15.3 Host classes (no hardware choice forced here)

| Class | Role |
|---|---|
| Mac local | Acceptable for streaming if external/volume free space meets §15.2 |
| External disk | Preferred Layer B mount |
| Cloud VM near S3 | Preferred for wall-clock; same Docker image |

---

## 16. Docker / runtime

- Image family: `paper3-acquisition` (pilot tag `0.2.0` validated).  
- Separate from `postgres:16` / `cris-db`.  
- Credentials: external, read-only / anonymous `--no-sign-request` as appropriate; **never** in Dockerfile, image layers, git, or manifests.  
- Mounts (illustrative env):

| Env | Meaning |
|---|---|
| `PAPER3_DATA_ROOT` | host path → `/data/paper3` |
| `AWS_ACCESS_KEY_ID` / role / unsigned | optional |
| `PAPER3_MIN_FREE_BYTES` | preflight |

Canonical outputs must land on **host mounts**, never only in ephemeral container FS.

---

## 17. SOURCES binding

Before full WORKS production seal:

1. Pin SOURCES manifest for the same release family (`manifest.date=2026-06-26`).  
2. Prefer re-hash of local `data/openalex-snapshot/sources/` (byte-total already matched decision record) **or** re-pull from S3 into `data/paper3/raw_sources/sources/`.  
3. Record `sources_manifest_sha256` + per-object inventory (120 files).  
4. **Do not** mix an unverified older SOURCES tree with the pinned WORKS release.

`cris_victoria.works` / institutional CRIS tables are **out of scope** and must not be joined as the Paper 3 WORKS universe.

---

## 18. Taxonomy binding

Produce (during binding phase, still outcome-blind):

`data/paper3/taxonomy/canonical_topic_taxonomy.json`

Deterministic order by `topic_id` ascending. Minimum fields:

- `topic_id`, `topic_name`
- `subfield_id`, `subfield_name`
- `field_id`, `field_name`
- `domain_id`, `domain_name`

Also store raw parquet pins + SHAs for `topics`, `subfields`, `fields`, `domains`.

`taxonomy_hash = SHA-256(canonical_topic_taxonomy.json)`.

**Forbidden:** computing journal thematic identity from this vocabulary during acquisition.

---

## 19. Validation (per shard)

Allowed checks:

- exact schema / `schema_hash`;
- all `publication_year` in `[2000, 2026]` (Stage-2; Stage-1 same);
- `work_id` non-null / non-empty;
- structural null rates (availability only);
- row count / bytes;
- no prohibited column names (firewall column guard);
- Stage-1: optional within-shard duplicate `work_id` check (should be 0).

Forbidden during validation: drift, journal thematic distributions, quartiles, temporal coupling, outcome tables.

---

## 20. Global validation (post full scan)

| Check | Requirement |
|---|---|
| Expected objects | 2446 |
| Completed / verified | 2446 |
| Failed | 0 (or run FAIL) |
| Input rows scanned | sum of object `record_count` processed |
| Output rows | Stage-2 total |
| Bytes in / out | recorded |
| Per-year row counts | **availability counts only** |
| Schema consistency | single `schema_hash` |
| Duplicates | 0 (default policy) |
| SOURCES / taxonomy | bound hashes present |
| Firewall | PASS |
| `tmp_restricted` | empty (aside from ignore markers) |
| Revalidation | any shard re-hashable offline without S3 if Stage-1/2 retained |

---

## 21. Contamination rule

Reuse protocol v1.1 **§1.3**:

If acquisition computes or exposes a prohibited outcome-bearing quantity:

1. log contamination event (artifact paths, what leaked, when);  
2. contaminated outputs **cannot** feed preregistration;  
3. clean rerun from pinned Layer A required;  
4. event retained in provenance forever.

Acquisition sets `prohibited_outcomes_computed = false` only if no such event occurred.

---

## 22. Directory layout

```text
data/paper3/
  bootstrap/                          # pilot artifacts (already present)
  raw_manifests/
    works_manifest.pinned.json        # copy/pin of WORKS manifest
    sources_manifest.pinned.json
    raw_object_inventory.json
    taxonomy_manifests/
  raw_sources/                        # optional physical Layer A
    sources/
    topics/ subfields/ fields/ domains/
    works/                            # optional full archive (external disk)
  taxonomy/
    canonical_topic_taxonomy.json
    *.sha256
  layer_b/
    shards/
      stage1/object_index=NNNN/part.parquet
      stage2/publication_year=YYYY/part-XXXXX.parquet
    manifests/
      checkpoint.jsonl
      layer_b_shards_manifest.json
      paper3_full_acquisition_manifest.json
    checksums/
  phase0/                             # post-Layer-B Phase-0 working binds (later)

feasibility/
  out/                                # allowlisted aggregates only
  tmp_restricted/                     # must be empty at seal
```

**Never** use `/tmp` for canonical artifacts.

---

## 23. Full acquisition manifest schema

**Path:** `data/paper3/layer_b/manifests/paper3_full_acquisition_manifest.json`

Minimum fields:

```json
{
  "project": "paper3",
  "phase": "layer_b_acquisition",
  "spec_id": "Paper3_Full_WORKS_Streaming_Acquisition_Spec_v1.0",
  "spec_sha256": "<sha256 of this markdown file at seal time>",
  "protocol_v1_1_sha256": "871b75fe47dd45d4a7249681996e178f4cf51acbcb8d345433fdfb729a53fdb8",
  "openalex_release_notes_date": "2026-06-25",
  "openalex_manifest_date": "2026-06-26",
  "works_manifest_sha256": "4b5142cb47f22fb5f6e91fc330ed800e355e8bb9421b10d812394780b9a1443d",
  "works_object_count": 2446,
  "works_total_content_length": 724970323127,
  "sources_manifest_sha256": "<pin>",
  "taxonomy_hash": "<pin>",
  "docker_image_digest": "<pin>",
  "dockerfile_sha256": "<pin>",
  "extractor_git_commit": "<commit or null if uncommitted>",
  "extractor_sha256": "<tree/blob hash of extractor modules>",
  "schema_hash": "<§6.4>",
  "filter_publication_year_min": 2000,
  "filter_publication_year_max": 2026,
  "expected_objects": 2446,
  "completed_objects": 0,
  "failed_objects": 0,
  "total_input_rows": 0,
  "total_output_rows": 0,
  "total_input_bytes": 0,
  "total_output_bytes": 0,
  "shards_manifest_sha256": "<layer_b_root>",
  "duplicate_policy": "fatal_on_duplicate_work_id",
  "n_duplicate_work_ids": 0,
  "contamination_log": [],
  "prohibited_outcomes_computed": false,
  "used_cris_victoria_works": false,
  "inherited_estudio1_universe": false,
  "PILOT_NUMBERS_USED_FOR_DESIGN_SELECTION": false,
  "run_started_at": null,
  "run_completed_at": null
}
```

---

## 24. PASS criteria (future full scan)

PASS only if all hold:

1. This Spec v1.0 was sealed (SHA recorded) **before** production start.  
2. Layer A inventory pinned and hash-locked.  
3. Docker image digest pinned.  
4. 2446 object keys registered.  
5. All objects treated per checkpoint rules (no silent skips).  
6. No silent failures.  
7. All shards hashed.  
8. `layer_b_shards_manifest.json` root hash recorded.  
9. Schema consistent.  
10. Filter 2000–2026 applied.  
11. SOURCES + taxonomy bound.  
12. `prohibited_outcomes_computed = false`.  
13. Firewall CI PASS.  
14. `feasibility/tmp_restricted/` clean.  
15. Full acquisition manifest complete.  
16. Dataset revalidable from local shards/manifests without re-reading S3 (for retained stages).

---

## 25. FAIL / STOP criteria

STOP production if:

- pinned WORKS manifest bytes/hash change;
- object key list or counts change vs inventory;
- object `content_length` mismatches unexpectedly;
- schema incompatible with §6;
- duplicate semantics unresolved (default: any duplicate);
- Docker image digest differs from sealed run pin;
- free space < minimum;
- prohibited outcome appears;
- firewall FAIL;
- writer non-determinism discovered (Level-2 mismatch without explained non-content cause);
- shard hash mismatch on resume/revalidate;
- credentials embedded in image/git;
- pipeline attempts to use `cris_victoria.works` as universe;
- Estudio1 universe inheritance;
- years/venues/hypotheses selected from scientific behavior or pilot Q1.

---

## 26. Reproducibility levels

| Level | Requirement | Status |
|---|---|---|
| **L1** | Pilot object byte-identical across two runs | **PASS** (`7d952e54…`) |
| **L2** | Before/during production: re-run a fixed set of `object_index` values chosen **only** by index rule, verify Stage-1 SHA match | Required before declaring writer sealed for full run |
| **L3** | Any future shard re-extractable from archived object bytes + image + extractor | Design target |

### 26.1 Level-2 index selection (technical, not scientific)

Fixed before full scan:

```text
LEVEL2_OBJECT_INDEXES = [0, 1, 2, 1222, 1223, 2443, 2444, 2445]
```

Rationale: first three, two mid-list (⌊N/2⌋−1, ⌊N/2⌋), last three — covers tiny early partitions and heavier tail indexes **without reading content to choose**.

Count = **8** objects. Do not replace with content-based sampling.

---

## 27. Relation to Phase 0 and Pipeline B

```text
Spec sealed
  → (approval) full streaming acquisition
  → Layer B sealed (manifests + root hash)
  → io_snapshot bind
  → Q1–Q10 (outcome-blind)
  → LDAM
  → Phase-0 seal
  → longitudinal design from feasibility only
  → Paper 3 preregistration
  → unlock Pipeline B
  → first construction of I(j,t) and P(j,t)
  → Tests E–I
```

Pilot Q1 must not short-circuit this sequence.

---

## 28. Exact future execution sequence (NOT executed now)

1. Seal this spec; record `spec_sha256`.  
2. Confirm protocol SHA and firewall PASS.  
3. Build/pin Docker image digest.  
4. Materialize `raw_object_inventory.json` (2446 keys).  
5. Pin SOURCES + taxonomy; write `canonical_topic_taxonomy.json`.  
6. Preflight disk (`minimum_free_space`).  
7. Run Level-2 reproducibility on the eight indexes.  
8. Process `object_index` 0…2445 with checkpointing (Stage-1).  
9. Stage-2 compaction + duplicate FATAL check.  
10. Write `layer_b_shards_manifest.json` + root hash.  
11. Write `paper3_full_acquisition_manifest.json`.  
12. Firewall + `assert_restricted_purged`.  
13. Declare Layer B sealed — **then** Phase 0 full Q1–Q10 (separate approval).

---

## 29. Exact commands proposed (DO NOT RUN in this design task)

> The following are **proposed** production commands. They are documentation only for this task.

```bash
cd "/Users/franga/Downloads/directorio-uta 7"

# 0) Seal check (after this file is frozen)
shasum -a 256 docs/paper3/Paper3_Full_WORKS_Streaming_Acquisition_Spec_v1.0.md
shasum -a 256 docs/paper3/Paper3_Feasibility_Audit_Protocol_v1.1.md
# expect protocol: 871b75fe47dd45d4a7249681996e178f4cf51acbcb8d345433fdfb729a53fdb8

python feasibility/ci/firewall_check.py

# 1) Build acquisition runtime (pin digest)
docker build -t paper3-acquisition:0.2.0 docker/paper3-acquisition
docker image inspect paper3-acquisition:0.2.0 --format '{{.Id}} {{index .RepoDigests 0}}'

# 2) Inventory (future module — not implemented in this design task)
docker run --rm \
  -v "$PWD":/work -w /work \
  -v "$PAPER3_DATA_ROOT":/data/paper3 \
  paper3-acquisition:0.2.0 \
  python -m feasibility.src.layer_b_inventory \
    --works-manifest data/paper3/bootstrap/works_manifest.pinned.json \
    --out /data/paper3/raw_manifests/raw_object_inventory.json

# 3) Bind SOURCES + taxonomy (future)
docker run --rm -v "$PWD":/work -v "$PAPER3_DATA_ROOT":/data/paper3 \
  paper3-acquisition:0.2.0 \
  python -m feasibility.src.layer_b_bind_sources_taxonomy

# 4) Level-2 byte repro on fixed indexes
docker run --rm -v "$PWD":/work -v "$PAPER3_DATA_ROOT":/data/paper3 \
  -e PAPER3_MIN_FREE_BYTES=107374182400 \
  paper3-acquisition:0.2.0 \
  python -m feasibility.src.layer_b_extract \
    --mode level2 \
    --object-indexes 0,1,2,1222,1223,2443,2444,2445

# 5) Full Stage-1 streaming extract (REQUIRES EXPLICIT APPROVAL)
docker run --rm -v "$PWD":/work -v "$PAPER3_DATA_ROOT":/data/paper3 \
  -e PAPER3_MIN_FREE_BYTES=107374182400 \
  paper3-acquisition:0.2.0 \
  python -m feasibility.src.layer_b_extract \
    --mode stage1 \
    --from-index 0 --to-index 2445 \
    --resume

# 6) Stage-2 compaction + duplicate check
docker run --rm -v "$PWD":/work -v "$PAPER3_DATA_ROOT":/data/paper3 \
  paper3-acquisition:0.2.0 \
  python -m feasibility.src.layer_b_compact_stage2

# 7) Seal manifests + firewall
docker run --rm -v "$PWD":/work -v "$PAPER3_DATA_ROOT":/data/paper3 \
  paper3-acquisition:0.2.0 \
  python -m feasibility.src.layer_b_seal
python feasibility/ci/firewall_check.py
```

**Explicitly not proposed as the primary path:**  
`aws s3 sync s3://openalex/data/parquet/works` onto the laptop root volume (~141 GiB free).

---

## 30. Explicit prohibited actions (this task and production design)

- Download / loop all 2 446 WORKS objects under this design task.  
- Start full scan without seal + approval.  
- Run Q2–Q10 as part of acquisition design.  
- Compute I, P, JSD, quartiles, drift, lags, persistence, coupling, H1–H4, Tests E–I.  
- Modify protocol v1.1 or sealed permitted-output list.  
- Weaken firewall to place per-work rows in `feasibility/out/`.  
- Use `/tmp` for canonical Layer B.  
- Use `cris_victoria.works` as Paper 3 universe.  
- Target historical `works_uni` / SHA.  
- Select partitions or years by scientific convenience.  
- `git commit` / `git push` unless separately requested.

---

## 31. Risks and open engineering items (non-scientific)

1. **Pilot slim ratio not representative** — Class B columns + larger parts may push Layer B toward tens of GiB; 250 GiB free recommended.  
2. **`counts_by_year` / `topic_assignments` width** — dominant size drivers; measure on Level-2 before production.  
3. **Writer determinism across pyarrow upgrades** — pin 19.0.1; Level-2 gate.  
4. **Stage-1 + Stage-2 dual retention** — temporary disk spike; define post-seal deletion policy.  
5. **SOURCES local pin completeness** — re-hash per file before binding.  
6. **Network longevity** — multi-hour/day stream; checkpointing mandatory.  
7. **Duplicate FATAL** may halt a long run if archive contamination; keep Layer A inventory pure.  
8. **Implementation modules named in §29 do not exist yet** — this spec freezes behavior before code.

---

## 32. Seal readiness statement

This document is intended to be **sealable** as the normative acquisition architecture once the author accepts:

- two-stage sharding (Option C);  
- Class A + Class B schema (§6);  
- duplicate = FATAL default;  
- Level-2 index list;  
- resource floors.

**Full WORKS scan remains blocked until explicit approval after seal.**

---

## Document control

| Item | Value |
|---|---|
| Version | 1.0 |
| Kind | Engineering specification (not protocol amendment) |
| Pilot dependency | Q1 vertical slice v0.2 PASS |
| Full scan under this task | **NOT STARTED** |
| Scientific outcomes under this task | **NONE** |
