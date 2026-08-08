# Seal Certificate — Paper 3 Longitudinal Feasibility Audit Protocol v1.1

**Status:** FROZEN (Phase-0 feasibility protocol, outcome-blind)
**Sealed (UTC):** 2026-08-07T23:57:55Z
**Author:** Francisco Javier Garrido Valdés · RosFlo Limitada · ORCID 0000-0002-6512-8924
**Study (working title):** *Dynamic Coupling Between Journal Thematic Identity and Competitive Position: A Longitudinal Analysis*

---

## Canonical seal

The authoritative byte-stream is the Markdown master. Its SHA-256 is the value that governs the seal and is recorded as the first field of the future LDAM.

| Item | Value |
|---|---|
| Canonical file | `Paper3_Feasibility_Audit_Protocol_v1.1.md` |
| Format | Markdown (UTF-8) |
| Bytes | 18256 |
| Lines / words | 207 / 2408 |
| **SHA-256** | `871b75fe47dd45d4a7249681996e178f4cf51acbcb8d345433fdfb729a53fdb8` |

Derived views (DOCX, PDF) are informational only and are **not** byte-reproducible — they embed renderer build timestamps. Their as-built hashes are logged in `Paper3_Feasibility_Audit_Protocol_v1.1.SEAL.json` for reference, not as reproducibility anchors.

## Provenance chain (bound at seal)

authorizing protocol (this SHA-256) → executing code (Pipeline A script hashes) → source snapshot (date + taxonomy + vocabulary hash) → produced outputs (Q1–Q10 in the LDAM) → fed decision (design selection, §9).

The protocol's own hash will be stored inside the LDAM, so the first link is explicit rather than implied.

## Firewall declaration

Outcome-blind. Phase 0 computes input availability and marginal, univariate data-quality distributions only. It does **not** compute I(j,t) or P(j,t) as analysis objects, any I↔P relationship, or any Test E–I statistic, lag, persistence contrast, or susceptibility stratification. The §1.3 contamination rule governs any breach: a clean rerun from the sealed snapshot, with the incident retained in the provenance record.

## git_commit = null (by design)

The seal does not reference a git commit, to avoid circularity (the commit will contain the seal). The commit/push is performed by the author; the committed object carries this seal.

## Next step after seal

Implement Pipeline A (`/feasibility/`) with the firewall CI check; leave `/analysis/` locked. No H1–H4, JSD, lags, persistence, or metrics are introduced before the LDAM is sealed and the design is selected.

*This document knows nothing about the result Paper 3 later seeks. That is its purpose.*
