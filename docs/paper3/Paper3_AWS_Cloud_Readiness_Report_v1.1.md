# Paper 3 — AWS Cloud Readiness Report v1.1

**Phase:** Production-blocker closure (B1 + B2)  
**Supersedes operational status in:** v1.0 Phase-2 initial preflight  
**Full scan:** NOT STARTED  
**Auth gate:** CLOSED  

---

## Distinction

| Phase | Status |
|---|---|
| Phase 2 initial preflight | Completed earlier (S3 bundle checkout; 35/36 + deselect; `paper` push blocked) |
| **This closure** | Deterministic disk-guard tests; Option A clean branch; remote `paper3-production` published |

## Git blocker (B1) resolution

| Field | Value |
|---|---|
| Strategy | **OPTION A** — clean branch cherry-pick (no shared-history rewrite) |
| Backup | `pre-paper3-git-cleanup-backup` (+ local bundle under `/tmp/paper3-git-safety/`) |
| Excluded blob | `_to_delete/repo-src-verify.tgz` / `017a1ffc638683acfcc9fb0ad754b2d7ae966e14` (~230 MiB) |
| Reachable from remote branch? | **No** |
| Remote | `paper` → `https://github.com/Franga2026/journal-thematic-identity.git` |
| Branch | `paper3-production` |
| Remote HEAD (pre-provenance-v2 push) | `067c98ae6fd607f2c91b160672a1ceeea806916d` |
| Remote tree | `f8edc74c7884adb7f3d8a0f7ee872ead37a77859` |

## Disk-guard blocker (B2) resolution

| Field | Value |
|---|---|
| Diagnosis | Flaky equality of two live `statvfs` free-space probes |
| Fix | Injectable `free_bytes_provider`; deterministic unit cases; production default still real FS |
| Production floor | Unchanged (≥250 GiB operational requirement intact) |
| Fix commit on `release-qss-v1` | `3becb484e012344a722cd9b2415a68cde00478c6` |
| Local tests | **40 passed**, 0 failed / skipped / deselected / xfailed |
| Firewall | PASS |

## Provenance

| Artifact | SHA-256 |
|---|---|
| v1 (preserved) | `583ffac13b87a509fb637266d4c1edca98e232dc073f1b38f7ea1c6aacf2bf1c` |
| v2 | `f8dd1a67a4957d0fbabf149e2ef6bd8c3bf26228203727450184049d349b3121` |

Path: `docs/paper3/provenance/paper3_preproduction_git_provenance_v2.json`

## AWS (unchanged infrastructure)

| Field | Value |
|---|---|
| Instance | `i-0a6aee8e70d582361` |
| Region | `us-east-1` |
| Type | `m6i.2xlarge` |
| Data EBS | `vol-09f3741285567b464` (500 GiB gp3) |
| Expected state after closure | **stopped** (no full-scan auth yet) |

## Normative anchors (must remain MATCH)

Protocol / Spec / WORKS / SOURCES manifest / SOURCES inventory **body digest** / Taxonomy / Pilot / Dockerfile — unchanged sealed values.

## Absolute status

- Full WORKS scan was NOT started.
- Q2–Q10 were NOT executed.
- NO Paper 3 scientific outcome was computed or inspected.
- Auth gate CLOSED.
