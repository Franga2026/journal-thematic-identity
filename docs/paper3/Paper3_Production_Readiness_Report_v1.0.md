# Paper 3 — Production Readiness Report v1.0

**Status:** readiness closure for full WORKS streaming acquisition  
**Date (UTC context):** 2026-08-08  
**Full WORKS scan:** **NOT STARTED**  
**Scientific outcomes:** **NONE COMPUTED / NONE INSPECTED**

---

## 1. Normative anchors

| Anchor | SHA-256 / value | Status |
|---|---|---|
| Protocol v1.1 | `871b75fe47dd45d4a7249681996e178f4cf51acbcb8d345433fdfb729a53fdb8` | MATCH |
| Acquisition Spec v1.0 | `e8dd00f702f09cfe256cae439dec76659007cff0e8fac58269d612fc2a22d443` | MATCH (sealed; unmodified) |
| WORKS manifest | `4b5142cb47f22fb5f6e91fc330ed800e355e8bb9421b10d812394780b9a1443d` | MATCH |
| Pilot slim parquet | `7d952e5418e76cbced41042c0e3ce645fd63d652aa611d9289b04842abc92f8d` | MATCH |
| Docker image | `paper3-acquisition:0.2.0` · `sha256:3a7dbe684a28d1ccb4659ffe5138384960eb234ed8d2f1a03580f3b31cf5e76b` | PINNED |
| Firewall CI | PASS | PASS |
| Acquisition unit tests | 36 passed | PASS |

---

## 2. SOURCES binding

| Field | Value |
|---|---|
| Status | **VERIFIED_SOURCE_BINDING** |
| Manifest | `data/paper3/raw_manifests/sources_manifest.pinned.json` |
| Manifest date | 2026-06-26 |
| RELEASE_NOTES | 2026-06-25 |
| Manifest SHA-256 | `47fc6357545f074d6f6d140703e3cfa0ca5b453d7b31bc3158e0f136f5133b1f` |
| Local inventory | `data/paper3/raw_manifests/sources_local_inventory.json` |
| Inventory SHA-256 (canonical body) | `497b0eb3639ffb1a2b02aca1b6112ce005638fc7331881a8a1295d81c4d2f879` |
| Objects | 120 / 120 mapped bijectively |
| Proof | per-file local SHA-256 recorded; sizes match manifest `content_length`; ETag never treated as SHA-256 |

Local tree: `data/openalex-snapshot/sources/` (filename mapping `data__parquet__sources__…` → S3 keys).

---

## 3. Taxonomy binding

| Field | Value |
|---|---|
| Status | **VERIFIED_TAXONOMY_BINDING** |
| Canonical file | `data/paper3/taxonomy/canonical_topic_taxonomy.json` |
| Canonical SHA-256 | `272d16dab98d6456a0069bb1b82e6ddfd12b60a853d464384f148f6804dadf0f` |
| Taxonomy manifest | `data/paper3/taxonomy/taxonomy_manifest.json` |
| Counts | topics **4516**, subfields **252**, fields **26**, domains **4** |
| Hierarchy | topic→subfield→field→domain IDs resolve; no duplicate topic_ids |
| Byte reproducibility | **PASS** (run1 SHA == run2 SHA) |
| Journal identity | **not** computed |

Raw pins under `data/paper3/taxonomy/raw/` (same release family `manifest.date=2026-06-26`).

---

## 4. Storage targets

Measured host:

| Target | Free | Docker | Persistent path | Risk | Recommendation |
|---|---:|---|---|---|---|
| **A. Mac local** (`/System/Volumes/Data`, APFS) | **~129 GiB** | yes | repo `data/paper3/` | Below 250 GiB streaming floor; Layer B + scratch may fill volume | **NO for production** |
| **B. External disk** | none mounted | n/a | n/a | unavailable now | Attach ≥250 GiB (prefer ≥400 GiB) if local preferred |
| **C. Cloud/VM near S3** | provision on demand | yes | `/data/paper3` mount | ops/setup | **YES — documented production target** |

Cloud target spec (documented ready):

- Image: `paper3-acquisition:0.2.0` (`sha256:3a7dbe68…e76b`)
- Free disk: **≥250 GiB** (recommended **≥400 GiB**)
- Mount: `/data/paper3`
- Prefer same-region access to `s3://openalex`
- Strategy C streaming (no full Layer A archive required; archive would need ≥1 TiB)

`storage_readiness_status` = **LOCAL_INSUFFICIENT_CLOUD_TARGET_DOCUMENTED**

Artifact: `data/paper3/bootstrap/storage_readiness.json`

---

## 5. Level-2 reproducibility

| Field | Value |
|---|---|
| Status | **LEVEL2_PASS** |
| Indexes | 0, 1, 2, 1222, 1223, 2443, 2444, 2445 |
| Transfer budget | 1 859 772 092 bytes (~1.732 GiB) |
| Objects tested | **8 / 8** |
| Result | all `run_a_sha256 == run_b_sha256` |
| Report | `data/paper3/bootstrap/level2_reproducibility_report.json` |

Selection was index-deterministic (not content-based). Column projection used for memory safety on large parts.

---

## 6. Firewall status

- `python feasibility/ci/firewall_check.py` → **PASS**
- Acquisition bundle (firewall + no-raw-writes + spec binding) → **PASS**
- `feasibility/tmp_restricted/` → empty (`.gitignore` only)

---

## 7. Auth-gate status

| Check | Result |
|---|---|
| Env default `FULL_SCAN_AUTHORIZED` | `false` |
| `run_production_full_scan()` | **REFUSED / STOP** |
| `allow_full_scan=True` on single-object path | **REFUSED** |
| Gate opened in this task | **NO** |

---

## 8. Remaining blockers (pre-start only)

1. **User explicit authorization** to start the 2446-object scan.  
2. **Provision execution target** meeting ≥250 GiB free (cloud VM recommended; or mount external disk).  
3. Keep auth gate closed until start; only then enable a dedicated production entrypoint under controlled env.  
4. Optional: commit readiness artifacts (user).

No scientific design blockers remain for infrastructure authorization.

---

## 9. GO / NO-GO

**READY FOR FULL-SCAN AUTHORIZATION**

Conditional execution constraint: **do not run production on the current Mac volume (~129 GiB free)**. Use the documented cloud/external target.

---

## 10. Exact conditions required before full scan

1. User says explicitly that full WORKS acquisition is authorized.  
2. Target host has ≥250 GiB free and Docker can run `paper3-acquisition:0.2.0` with pinned digest.  
3. Repo bindings still match sealed SHAs (protocol, spec, WORKS manifest).  
4. Firewall PASS immediately before start.  
5. `FULL_SCAN_AUTHORIZED` only enabled for the production entrypoint on that host.  
6. Checkpointing + disk guard active; no use of `cris_victoria.works` as universe.  
7. No Q2–Q10 / H1–H4 / Tests E–I during acquisition.

---

## Confirmations

- Full WORKS scan was NOT started.  
- NO Paper 3 scientific outcome was computed or inspected.
