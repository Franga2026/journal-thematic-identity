# Paper 3 — OpenAlex Snapshot Acquisition / Phase-0 Data Foundation  
**Decision record v1.0** (engineering — not a sealed protocol amendment)

| Field | Value |
|---|---|
| Project | Paper 3 — *Dynamic Coupling Between Journal Thematic Identity and Competitive Position: A Longitudinal Analysis* |
| Governing sealed protocol | `Paper3_Feasibility_Audit_Protocol_v1.1.md` |
| Protocol SHA-256 | `871b75fe47dd45d4a7249681996e178f4cf51acbcb8d345433fdfb729a53fdb8` |
| Status of this document | **Decision / acquisition audit only** — no mass download executed |
| Repo | `/Users/franga/Downloads/directorio-uta 7` |
| Consulted (UTC) | 2026-08-08 (local inventory + official OpenAlex docs + S3 **manifests only**) |
| Firewall at audit time | `python feasibility/ci/firewall_check.py` → **PASS** |

---

## 0. Scope and hard rules observed

This document answers **how** to obtain a reproducible OpenAlex foundation for Phase 0 (Q1–Q10). It does **not**:

- download WORKS content objects;
- run H1–H4 or Tests E–I;
- compute I(j,t), P(j,t), JSD, drift, quartiles, lags, persistence, coupling, or susceptibility;
- modify protocol v1.1, the permitted-output allowlist, or the firewall;
- select the definitive longitudinal universe, windows, lags, or thresholds;
- attempt to reproduce `works_uni = 17807121` or the lost parquet SHA by parameter tuning;
- use `/tmp` as a future canonical provenance location.

Historical Estudio1 artifact hashes are recorded **for provenance only**, not as reproduction targets.

---

## 1. Local state found

### 1.1 Disk

| Mount | Size | Used | Avail | Capacity |
|---|---:|---:|---:|---:|
| `/System/Volumes/Data` (workspace volume) | 926 GiB | 745 GiB | **~141 GiB** | 85% |

**Critical constraint:** current free space **cannot** hold a full WORKS parquet copy (~675 GiB; see §2). Any Layer A materialization of WORKS requires an **external volume** (≥1 TB recommended) or a **streaming extract** that never persists the full raw WORKS set locally.

### 1.2 `data/openalex-snapshot/`

| Path | Status |
|---|---|
| `data/openalex-snapshot/` | Present |
| `data/openalex-snapshot/sources/` | **120** parquet files · **170 336 587** bytes (~162.4 MiB) |
| `data/openalex-snapshot/works/` | **Absent** |
| Local sources `updated_date` range (from filenames) | 2026-02-09 … 2026-06-26 |

Loader that produced local sources: `load_openalex_sources.py` (repo root and `cris-discovery-api/scripts/`) — downloads **only** `s3://openalex/data/parquet/sources/` with anonymous AWS access (`--no-sign-request` pattern / unsigned boto3).

### 1.3 Compatibility of local SOURCES vs live S3 (manifest check)

Live S3 parquet sources manifest (downloaded for audit only):

| Field | Value |
|---|---|
| `date` | `2026-06-26` |
| `record_count` | 283 287 |
| `content_length` | **170 336 587** |
| `n_files` | 120 |

**Local total bytes == S3 `content_length` (exact).** Same file count. This is strong evidence that the on-disk SOURCES tree matches the current public parquet SOURCES release, but **per-object SHA-256s were not computed in this audit**. Before Phase 0 execution, re-hash every local object and pin them in Layer A manifest (§8). Do **not** silently mix an older SOURCES tree with a newly synced WORKS tree without that pin.

### 1.4 `feasibility/` (Pipeline A — live root)

| Item | Status |
|---|---|
| Location | **Repo root** `feasibility/` (canonical per protocol §8) |
| Firewall CI | **PASS** (13 sources scanned; 37 prohibited tokens; `analysis/` locked; `out/` allowlist clean) |
| Runtime guards | `feasibility/src/firewall.py` wired via `writers.write_permitted` |
| `out/` | empty (`.gitkeep` only) |
| `tmp_restricted/` | self-ignored via `.gitignore` |
| Q1–Q10 bodies | stubs (`NotImplementedError`) — no outcomes computed |

**Note:** a nested copy also exists under `docs/paper3/feasibility/` (remnant). The **authoritative** Pipeline A root for CI/pathing is **`/feasibility` at repo root**. Nested docs copy must not be treated as production.

### 1.5 `docs/paper3/`

| Artifact | Role |
|---|---|
| `Paper3_Feasibility_Audit_Protocol_v1.1.md` | Sealed master · SHA-256 `871b75fe47dd45d4a7249681996e178f4cf51acbcb8d345433fdfb729a53fdb8` |
| `…SEAL.json` / `…SEAL_CERTIFICATE.md` / `…SHA256SUMS.txt` | Seal package |
| `Paper3_Phase0_SliceSpec_io_snapshot_Q1_v0.1.md` (+ docx/pdf) | Engineering slice spec (unsealed); discusses sources-only vs works substrate |

### 1.6 Estudio1 provenance (lost WORKS compact — hashes only)

From `cris-discovery-api/research/estudio1/estudio1_run_manifest_canonical_A_universe.json`:

| Field | Full value |
|---|---|
| `openalex_snapshot` | `2026-06-25` |
| `universe_works.parquet` SHA-256 | `5f4b5dbcf9b2b3d8a21f3e5c6395b57f7aa9378a13771d37d796f79a6f86a223` |
| `universe_profile.parquet` SHA-256 | `79a08fe145bb80e5149c838e00926492bcddc1fb3525237237a2472e70c38445` |
| `universe_source_map.csv` SHA-256 | `6275b56fedfe6697d4dad1d4a579b7880f78b0c3f5fe067e78c35df2e1c010c0` |
| `works_uni` | **17 807 121** |
| `openalex_sources` (DB count in that run) | 26 636 |
| Analysis window in params | `2021-2024` / `W0_2021_2024` |

Consumer (does **not** create the parquet): `cris-discovery-api/scripts/estudio1_pruebaCprima.py` defaults to `/tmp/universe_works.parquet`.  
**On disk today:** those three files are **absent**. Original extractor **not in repo/git**. This decision does **not** aim to recreate that artifact.

### 1.7 Other OpenAlex-related code (non-exhaustive)

| Script / area | Role |
|---|---|
| `load_openalex_sources.py` | SOURCES parquet → Postgres |
| `cris-discovery-api/scripts/journal_identity_extract.py` | Per-journal works via **API** (Papers 1–2 identity), not snapshot bulk |
| `cris-discovery-api/scripts/sync_topics.py` | Topics API sync |
| Frontend/ODS enrich scripts | REST API (`api.openalex.org`) — product, not Phase 0 |
| AWS product docs (`docs/architecture/AWS.md`) | Mentions API/Postgres; **not** OpenAlex snapshot sync infra for Paper 3 |

### 1.8 `data/paper3/`

**Does not exist yet.** Proposed layout in §10.

---

## 2. Official OpenAlex source (current)

**Primary docs consulted (2026-08-08):**

| URL | Topic |
|---|---|
| https://developers.openalex.org/download/overview | Download options overview |
| https://developers.openalex.org/download/download-to-machine | AWS CLI sync instructions |
| https://developers.openalex.org/download/snapshot-format | Bucket layout, partitions, manifests |
| https://developers.openalex.org/download/openalex-cli | Filtered API CLI (metadata subsets) |
| https://developers.openalex.org/api-reference/works | Works filterable fields |
| https://developers.openalex.org/api-reference/topics | Topics hierarchy |
| https://developers.openalex.org/llms.txt | API quick reference |
| https://openalex.s3.amazonaws.com/browse.html | Browser browse of bucket |
| `s3://openalex/RELEASE_NOTES.txt` | Release labels (fetched) |
| `s3://openalex/data/parquet/{works,sources,topics,subfields,fields,domains}/manifest.json` | Live manifests (fetched; **data parts not synced**) |

### 2.A–L answers

| # | Question | Finding |
|---|---|---|
| **A** | How distributed? | Public **Amazon S3** bucket `openalex` under `data/`; dual format **JSON Lines (gzip)** and **Apache Parquet (snappy)** |
| **B** | Official location | `s3://openalex/data/jsonl/` and `s3://openalex/data/parquet/`; browse UI above |
| **C** | Auth? | **No AWS account** for public snapshot (`aws … --no-sign-request`). Transfer fees covered by AWS Open Data. Enterprise **daily** dated snapshots need paid API key + `openalex-snapshots` staging bucket |
| **D** | WORKS / SOURCES | Separate entity prefixes: `…/works/`, `…/sources/` (plus authors, institutions, topics, subfields, fields, domains, …) |
| **E** | WORKS partitioning | By **`updated_date=YYYY-MM-DD`**, not by publication year. Parts `part_NNNN.parquet` / `.gz`, up to ~400k records each |
| **F** | Year selection before download? | **No.** Publication-year filtering requires **scanning/filtering records**. You cannot sync only “2000–2026 pub years” via S3 prefixes |
| **G** | Format | Parquet and/or JSONL; schemas align with API entity objects |
| **H** | WORKS size (live manifests, 2026-06-26) | Parquet: **724 970 323 127 B (~675.18 GiB)**, **510 372 821** records, **2446** files, **482** `updated_date` partitions. JSONL works: **~620 GiB** compressed, same record count / 2446 files |
| **I** | Official sync | `aws s3 sync` of chosen prefix; incremental via new `updated_date` partitions; re-check manifest after sync |
| **J** | Version / date ID | Per-entity `manifest.json` field `date`; bucket `RELEASE_NOTES.txt` release labels (e.g. `RELEASE 2026-06-25`); enterprise: dated folder under `s3://openalex-snapshots/full/YYYY-MM-DD/` |
| **K** | Checksums / metadata | Official manifests list each object `url`, `meta.content_length`, `meta.record_count`. **No per-object SHA-256 in the official manifest.** Local SHA-256 of every retained object is **our** freeze mechanism |
| **L** | Freeze a release | (1) Public: sync once, pin manifest `date` + all local SHA-256s, never `--delete` into that freeze tree; (2) Enterprise: pull a dated `full/YYYY-MM-DD` folder. Free public snapshot is **quarterly**; live bucket continues to receive updates |

### 2.1 Live release pin candidate (from this audit)

| Item | Value |
|---|---|
| `RELEASE_NOTES` head | **RELEASE 2026-06-25** |
| Parquet entity `manifest.date` (works/sources/topics/…) | **2026-06-26** |
| Proposed Paper 3 pin label | `openalex_public_parquet@manifest_date=2026-06-26` (release notes tag `2026-06-25`) |
| Match to Estudio1 label | Estudio1 recorded `openalex_snapshot: 2026-06-25` — consistent with release notes naming; **not** proof bit-identical to today’s bucket |

**Recommendation:** treat **manifest `date=2026-06-26` + RELEASE 2026-06-25** as the acquisition target label, and freeze by **local SHA-256 of every Layer A object actually used**.

---

## 3. WORKS / SOURCES structure (operational)

```
s3://openalex/data/parquet/
  manifest.json                 # combined
  works/manifest.json           # date, record_count, content_length, files[]
  works/updated_date=…/part_*.parquet
  sources/manifest.json
  sources/updated_date=…/part_*.parquet
  topics|subfields|fields|domains/…
```

Legacy pre-2026 flat layout lives under `legacy-data/` — **do not use** for Paper 3.

---

## 4. Snapshot / release available

- Public parquet snapshot is current and listable anonymously.
- WORKS is ~675 GiB parquet; SOURCES ~162 MiB; taxonomy entities tiny (topics ~2.5 MiB; subfields/fields/domains ≪1 MiB).
- Local machine **cannot** host full WORKS on the current volume (~141 GiB free).

---

## 5. Acquisition horizon 2000–2026

| Point | Decision |
|---|---|
| Horizon | **Publication years 2000–2026 inclusive** as the **generous acquisition window** |
| Meaning | Input envelope for Q1–Q10 — **not** the study span |
| Study span | Chosen later from §9 decision table (candidates 10 / 15 / 20 years) after LDAM |
| Filter locus | Applied in the **Layer B extractor** (`publication_year BETWEEN 2000 AND 2026`), not via S3 prefix selection |
| Inclusion rule | Bibliographic availability only — **do not** inherit the Estudio1 26 636-journal panel as the historical universe |

---

## 6. Required fields (WORKS / SOURCES)

### 6.1 Classification

| Kind | Meaning |
|---|---|
| **RAW FIELD** | Copied/derived 1:1 from OpenAlex entity bytes |
| **DERIVED AVAILABILITY FLAG** | Boolean/count summarizing presence — still outcome-blind |
| **PROHIBITED (Phase 0)** | Any longitudinal identity/position/coupling quantity |

### 6.2 WORKS — minimum for Q1–Q10 inputs

| Need (protocol §3 / Q*) | OpenAlex raw (API/snapshot) | Derived flag (allowed) | Prohibited |
|---|---|---|---|
| Work id | `id` | — | — |
| Publication year | `publication_year` / `publication_date` | — | — |
| Host source id | `primary_location.source.id` (fallback: first `locations[].source.id`) | `has_venue_id` | — |
| ISSN-L resolvable | join to SOURCES.`issn_l` / `issn` | `has_issn_l` | — |
| Document type | `type` | — | — |
| Language | `language` | — | — |
| Topics / subfields + scores | `primary_topic`, `topics[]` (id, score, subfield, field, domain) | `has_topic`, `has_subfield`, `n_topics` | **identity vector / topic share distributions as analysis objects** |
| Abstract availability | `abstract_inverted_index` present **or** API `has_abstract` | `has_abstract` | abstract text mining for identity |
| References | `referenced_works_count`; optionally `referenced_works` length | `has_references`, `referenced_works_count` | — |
| Cited-by | `cited_by_count` | `has_cited_by` | journal-level position / quartiles |
| Citation maturation inputs | work-level `counts_by_year` (citations by calendar year) | age = snapshot_year − publication_year; median cites vs age (**aggregate only**) | P(j,t), rank_to_quartile |
| Paratext filter support | `type` / legacy is_paratext | — | — |

### 6.3 SOURCES — minimum

| Need | Raw field | Notes |
|---|---|---|
| Source id | `id` | |
| ISSN / ISSN-L | `issn`, `issn_l` | |
| Display name | `display_name` | rename detection (Q7) |
| Type | `type` | |
| Works counts | `works_count`, `counts_by_year` | venue activity; **not** a substitute for work-level Q1 shares |
| Host org / publisher | `host_organization`, lineage fields if present | Q7 transfers |
| Topics on source | `topics` | snapshot-retrospective lens — tag temporality in Q6 |
| Updated date | `updated_date` | provenance |

### 6.4 Explicit prohibitions (must not appear in Layer B or `feasibility/out`)

`I(j,t)`, `P(j,t)`, JSD / nucleus / turnover, quartile trajectories, cross-lag / coupling / persistence / susceptibility / H1–H4 / Tests E–I statistics — per sealed protocol §1 and `feasibility/ci/prohibited_symbols.txt`.

---

## 7. Taxonomy (freeze plan)

OpenAlex hierarchy (official): **domain → field → subfield → topic**.

Live parquet counts (`manifest.date=2026-06-26`):

| Entity | `record_count` | Approx. bytes |
|---|---:|---:|
| `domains` | 4 | ~9 KiB |
| `fields` | 26 | ~19 KiB |
| `subfields` | 252 | ~174 KiB |
| `topics` | 4 516 | ~2.5 MiB |

**Freeze procedure (outcome-blind):**

1. Sync parquet (or JSONL) for `topics`, `subfields`, `fields`, `domains` from the **same** manifest date as WORKS/SOURCES.
2. Materialize a single vocabulary file, e.g. `data/paper3/raw/taxonomy/subfield_vocabulary_YYYYMMDD.parquet` (or CSV) listing every subfield id + display_name + parent field/domain ids.
3. Record `taxonomy_binding = { manifest_date, entity_sha256s…, vocabulary_sha256 }`.
4. Phase 0 may only report **coverage of assignments** and **confirm a single vocabulary hash** (Q4) — never build journal identity vectors.

---

## 8. Acquisition strategies compared

| | **A. Full WORKS download** | **B. “Only needed partitions”** | **C. Stream/scan → Layer B only** | **D. OpenAlex CLI / API filter** |
|---|---|---|---|---|
| What | `aws s3 sync s3://openalex/data/parquet/works` (+ sources + taxonomy) | Sync subset of `updated_date=*` prefixes | Read objects from S3 (or after partial sync on external disk), filter `publication_year∈[2000,2026]`, write slim Phase-0 tables; optionally discard raw parts | `openalex download --filter publication_year:…` via API |
| Bytes transferred | ~675 GiB works + ~0.2 GiB sources/taxonomy | Still **most/all** WORKS if you need all pub years (partitions ≠ pub year) | ~675 GiB **read** from S3 (or local external); persist only extract | Impractical for hundreds of millions of works (rate limits / cost model; CLI aimed at subsets) |
| Temp storage | ≥700 GiB | Similar unless tiny date subset | Buffer per part (~few hundred MB–GB) | Large if naïvely storing all JSON |
| Persistent storage | Full raw + extract | Full raw subset + extract | **Layer B only** (estimate tens of GiB; TBD after pilot) | Same as extract |
| Time (order-of-mag) | Many hours–1+ day (network) | Similar | Many hours–1+ day scan + write | Weeks/impossible at full scale on free tier |
| Reproducibility | High if SHA-pinned | High for retained objects | High if extractor + raw object hashes + filter spec pinned | Weaker for “full horizon” (API drift, pagination) |
| Network dependency | High once | High once | High during extract | Continuous |
| Re-run | Cheap if raw kept | Cheap if raw kept | Requires re-scan unless raw kept | Expensive |
| Source-change risk | Pin manifests + SHA | Same | Same | High |
| Hash-pinning | Excellent | Excellent | Excellent if every scanned object hashed | Weak |
| Complexity | Low ops / high disk | Medium (false hope on year filter) | Medium–high (extractor engineering) | Low for small N; unfit for Phase 0 horizon |
| Fit for 2000–2026 Q1–Q10 | Yes, if disk exists | **Misleading** as year filter | **Best given 141 GiB free** | No for full horizon |
| Recommendation | Use **only with ≥1 TB external volume** as Layer A archive | **Reject** as pub-year strategy | **Primary recommendation** | Bootstrap/smoke tests only |

### 8.1 Recommended strategy (ordered)

1. **Attach external storage** (≥1 TB) **or** accept streaming-only Layer A (no full local WORKS).
2. **Pin** SOURCES + taxonomy from the same manifest date (local SOURCES already byte-total-matched; still re-hash).
3. **Implement Layer B extractor** (spec next; code later) that:
   - reads WORKS parquet parts (from external sync **or** direct S3);
   - keeps rows with `publication_year ∈ [2000, 2026]`;
   - writes slim columns only (§6);
   - records every source object URL + bytes + sha256 in `paper3_snapshot_manifest.json`;
   - never computes prohibited symbols.
4. Optional later: keep a full WORKS parquet tree on external disk as Layer A archive for re-extracts.

---

## 9. Storage estimates

| Asset | Size |
|---|---|
| WORKS parquet (full) | **~675 GiB** |
| WORKS JSONL (full, compressed) | **~620 GiB** |
| SOURCES parquet | **~162 MiB** |
| Taxonomy (topics+subfields+fields+domains) | **~3 MiB** |
| Layer B slim 2000–2026 (order-of-magnitude) | **~30–150 GiB** depending on column width / topic arrays — **measure on a 1-part pilot** before committing |
| Current free on laptop volume | **~141 GiB** → insufficient for Layer A WORKS |

---

## 10. Architecture — Layer A / Layer B

```
data/paper3/
  raw/                          # LAYER A — frozen OpenAlex objects actually used
    RELEASE_NOTES.txt
    manifests/
      works_manifest.json
      sources_manifest.json
      topics_manifest.json
      …
    parquet/                    # optional full tree (external volume preferred)
      works/…
      sources/…
      topics/… subfields/… fields/… domains/…
    taxonomy/
      subfield_vocabulary.parquet
      subfield_vocabulary.sha256
  phase0/                       # LAYER B — deterministic extract (Q1–Q10 inputs only)
    works_slim_2000_2026.parquet
    sources_slim.parquet
    paper3_snapshot_manifest.json
  bootstrap/                    # optional technical dry-runs (non-canonical)
    …                           # never /tmp

feasibility/
  out/                          # permitted Q1–Q10 aggregates only (allowlist)
  tmp_restricted/               # journal×window intermediates; purged
```

**Rules:**

- Layer A objects are **never** rewritten in place after pin.
- Layer B is rebuildable from Layer A + extraction_spec SHA.
- `/tmp` is forbidden for canonical artifacts.
- `feasibility/out/` remains allowlist-governed; Layer B lives under `data/paper3/phase0/`, not as a bypass of §8.

---

## 11. Manifest design — `paper3_snapshot_manifest.json`

Proposed schema (semantic; names adjustable):

```json
{
  "project": "paper3",
  "phase": "feasibility",
  "source": "OpenAlex",
  "license": "CC0",
  "snapshot_date": "2026-06-26",
  "release_notes_tag": "2026-06-25",
  "retrieved_at": "ISO-8601",
  "official_source": {
    "bucket": "s3://openalex",
    "format": "parquet",
    "browse": "https://openalex.s3.amazonaws.com/browse.html",
    "docs": [
      "https://developers.openalex.org/download/snapshot-format",
      "https://developers.openalex.org/download/download-to-machine"
    ]
  },
  "works_release": {
    "manifest_date": "2026-06-26",
    "record_count": 510372821,
    "content_length": 724970323127,
    "n_files": 2446
  },
  "sources_release": {
    "manifest_date": "2026-06-26",
    "record_count": 283287,
    "content_length": 170336587,
    "n_files": 120
  },
  "raw_objects": [
    {
      "entity": "works",
      "url": "s3://openalex/data/parquet/works/updated_date=…/part_0000.parquet",
      "local_path": "data/paper3/raw/parquet/works/…",
      "bytes": 0,
      "sha256": "…"
    }
  ],
  "raw_object_sha256": { "<relative_path>": "<sha256>" },
  "taxonomy_version_or_binding": {
    "manifest_date": "2026-06-26",
    "topics_record_count": 4516,
    "subfields_record_count": 252,
    "vocabulary_path": "data/paper3/raw/taxonomy/subfield_vocabulary.parquet",
    "vocabulary_sha256": "…"
  },
  "extraction_spec": {
    "publication_year_min": 2000,
    "publication_year_max": 2026,
    "columns": ["id", "publication_year", "…"],
    "universe_rule": "bibliographic_availability_only",
    "spec_sha256": "…"
  },
  "schema_hash": "…",
  "extractor_git_commit": null,
  "firewall_git_commit": null,
  "authorizing_protocol_sha256": "871b75fe47dd45d4a7249681996e178f4cf51acbcb8d345433fdfb729a53fdb8",
  "output_sha256": {
    "data/paper3/phase0/works_slim_2000_2026.parquet": "…"
  },
  "historical_estudio1_reference_only": {
    "universe_works_parquet_sha256": "5f4b5dbcf9b2b3d8a21f3e5c6395b57f7aa9378a13771d37d796f79a6f86a223",
    "works_uni": 17807121,
    "note": "Not a reproduction target for Paper 3 Layer B"
  },
  "prohibited_outcomes_computed": false,
  "git_commit": null
}
```

`git_commit` / extractor commit remain `null` until the author commits (same anti-circularity rule as the protocol seal).

---

## 12. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Disk too small for Layer A WORKS | **Blocker** on laptop volume | External ≥1 TB **or** stream-to-Layer-B |
| Partitions by `updated_date` ≠ pub year | High (process error) | Never claim year-prefix sync; filter in extractor |
| Live bucket mutates after pin | High | Freeze tree + SHA map; no blind `--delete` sync into freeze |
| Local SOURCES assumed same as WORKS without hashing | Medium | Re-hash all SOURCES objects; refresh if drift |
| Mixing Estudio1 universe into Phase 0 | High (bias) | Explicit bibliographic inclusion rule |
| API/CLI used as “full snapshot” | High | Reject for Layer A |
| Extractor invents analytical columns | Critical | Firewall CI + runtime guards + column allowlist in extraction_spec |
| Trying to hit 17 807 121 | Process | Forbidden by this decision |
| Nested `docs/paper3/feasibility` confusion | Low | Root `feasibility/` is authoritative |

### 12.1 Protocol conflict check

**No contradiction requiring stop.** Acquisition of work-level fields is exactly what protocol §3/Q1–Q10 require. The only operational conflict is **storage**, not epistemology. SliceSpec v0.1 Option A (sources-only Q1) remains a possible plumbing shakedown but **cannot** alone satisfy full protocol Q1; this decision record prioritizes a true WORKS Layer B path under the disk constraint.

---

## 13. Final recommendation

1. **Do not** download WORKS onto the current 141 GiB free volume.  
2. **Do** freeze SOURCES + taxonomy at manifest date **2026-06-26** (release notes **2026-06-25**), with per-file SHA-256.  
3. **Prefer Strategy C** (stream/scan WORKS → slim Layer B for `publication_year` 2000–2026) on an external volume or direct S3 read.  
4. If an external disk is available, optionally retain full WORKS parquet as Layer A archive (Strategy A+C).  
5. Build a **new** Paper 3 extractor (lost Estudio1 writer is not recoverable); accept non-equal counts vs `17807121`.  
6. Keep firewall unchanged; no outcomes in the extractor.  
7. **Await explicit approval** before any WORKS content sync/extract.

---

## 14. Proposed commands (NOT EXECUTED)

> These are the commands that would be run **after approval**. None of the WORKS sync/extract commands below were run in this task. Only tiny `manifest.json` / `RELEASE_NOTES.txt` fetches were performed for sizing.

### 14.1 Preconditions

```bash
# Confirm free space on the TARGET volume (external disk path TBD)
df -h /Volumes/YOUR_PAPER3_DISK

# Firewall still green
cd "/Users/franga/Downloads/directorio-uta 7"
python3 feasibility/ci/firewall_check.py
```

### 14.2 Pin manifests + taxonomy + sources (small)

```bash
ROOT="/Volumes/YOUR_PAPER3_DISK/paper3_raw"   # or data/paper3/raw on external
mkdir -p "$ROOT/manifests" "$ROOT/parquet" "$ROOT/taxonomy"

aws s3 cp s3://openalex/RELEASE_NOTES.txt "$ROOT/RELEASE_NOTES.txt" --no-sign-request
aws s3 cp s3://openalex/data/parquet/manifest.json "$ROOT/manifests/parquet_manifest.json" --no-sign-request
for e in works sources topics subfields fields domains; do
  aws s3 cp "s3://openalex/data/parquet/$e/manifest.json" \
    "$ROOT/manifests/${e}_manifest.json" --no-sign-request
done

# SOURCES + taxonomy only (≪1 GiB)
aws s3 sync s3://openalex/data/parquet/sources \
  "$ROOT/parquet/sources" --no-sign-request
aws s3 sync s3://openalex/data/parquet/topics \
  "$ROOT/parquet/topics" --no-sign-request
aws s3 sync s3://openalex/data/parquet/subfields \
  "$ROOT/parquet/subfields" --no-sign-request
aws s3 sync s3://openalex/data/parquet/fields \
  "$ROOT/parquet/fields" --no-sign-request
aws s3 sync s3://openalex/data/parquet/domains \
  "$ROOT/parquet/domains" --no-sign-request

# Re-download works manifest after sync of small entities; confirm date unchanged
aws s3 cp s3://openalex/data/parquet/works/manifest.json \
  "$ROOT/manifests/works_manifest.postcheck.json" --no-sign-request
```

### 14.3 Optional full WORKS archive (external disk only)

```bash
# ONLY if df shows ≥700 GiB free on target
aws s3 sync s3://openalex/data/parquet/works \
  "$ROOT/parquet/works" --no-sign-request
# Then hash every object into paper3_snapshot_manifest.json
```

### 14.4 Layer B extract (future script — not written in this task)

```bash
# Pseudo-invocation after extractor exists:
# python feasibility/src/extract_phase0_works.py \
#   --works-root "$ROOT/parquet/works" \
#   --year-min 2000 --year-max 2026 \
#   --out data/paper3/phase0/works_slim_2000_2026.parquet \
#   --manifest data/paper3/phase0/paper3_snapshot_manifest.json
```

### 14.5 Explicitly NOT proposed as Layer A for full horizon

```bash
# Do NOT rely on this for 2000–2026 Phase 0 foundation:
# openalex download --filter "publication_year:2000-2026" …
```

---

## 15. PASS / FAIL criteria before execution

| # | Criterion | PASS if |
|---|---|---|
| P1 | Firewall | `firewall_check.py` exits 0 |
| P2 | Target volume | Free space ≥ plan (stream: ≥200 GiB for Layer B+scratch; full archive: ≥700 GiB + Layer B) |
| P3 | Manifest coherence | works/sources/topics manifests share the same `date` |
| P4 | Post-sync manifest | works manifest unchanged vs pre-sync copy |
| P5 | SOURCES pin | Every local sources object hashed; totals match manifest `content_length` |
| P6 | Taxonomy pin | vocabulary file hashed; single binding recorded |
| P7 | Extraction spec | Year bounds 2000–2026; column allowlist only; `prohibited_outcomes_computed=false` |
| P8 | No `/tmp` canonical paths | All outputs under `data/paper3/…` or approved external root |
| P9 | No Estudio1 count targeting | Layer B rowcount may differ from 17 807 121; recorded, not optimized |
| P10 | Protocol untouched | v1.1 SHA still `871b75fe47dd45d4a7249681996e178f4cf51acbcb8d345433fdfb729a53fdb8` |
| **FAIL → do not run Phase 0** | Any of P1–P10 fail, or WORKS sync started onto undersized volume | |

---

## 16. Actions explicitly NOT executed in this task

- No `aws s3 sync` of WORKS content parts  
- No full snapshot download  
- No Layer B extract  
- No H1–H4 / Tests E–I  
- No I(j,t) / P(j,t) / JSD / drift / quartile / lag / coupling / persistence / susceptibility  
- No protocol / allowlist / firewall edits  
- No git commit / push  
- No deletion of files  
- No Papers 1–2 modifications  
- No selection of longitudinal universe / windows / lags / thresholds  
- No attempt to reproduce `5f4b5dbc…` or `17807121`  
- No creation of `data/paper3/` directories (layout proposed only)  
- Only lightweight fetches: entity `manifest.json` files + `RELEASE_NOTES.txt` for audit sizing  

---

## 17. Cross-check: 2446 files

Live WORKS parquet manifest lists **exactly 2446 files** — matching the oral-history figure from the lost compact extract pipeline. That corroborates that the historical bulk scan walked the same style of snapshot partitioning; it does **not** recover the lost extractor or parquet.

---

*End of decision record v1.0. Acquisition awaits explicit approval.*
