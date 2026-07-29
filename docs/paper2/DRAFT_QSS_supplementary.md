# Supplementary Material
### *Reconstructing Journal Thematic Identity from Article-Level Topics: A Reproducible Framework and a Preregistered Temporal Validation*

> **Status: draft, English (US).** Written to the same standard as the main text. Fields marked `⟦…⟧` are exact frozen values (hashes, a few counts) to be pasted from the repository during the number-verification pass. This document is the definitional and reproducibility reference for every quantity reported in the article; where a definition and the code differ, **the canonical implementation governs** and the text is corrected to match it.

---

## S1. Formal framework: definitions and propositions

**Definition 1 (methodological framework).** A framework is a triple ⟨T, A, C⟩: a subfield taxonomy T (here, the OpenAlex subfield level of the topic hierarchy), an aggregation rule A that maps a set of article-level topic assignments to a distribution over T, and an applicability condition C stating the data requirements under which A may be applied to a journal (a non-empty set of assignable works within the observation window).

**Definition 2 (thematic representation).** For a journal *j* satisfying C over an observation window, the thematic representation is R_j = A(D_j), where D_j is the collection of the journal's article-level subfield assignments in the window. R_j is a probability distribution over T. Under the **document-weighted** mode (`p_doc`), the mass of subfield *s* is the fraction of the journal's works assigned to *s*; under the **citation-weighted** mode (`p_cit`), it is the fraction of the journal's in-window citations accruing to works assigned to *s*.

**Principle 1 (observation–inference separation principle).** *A representation is observed; an identity is inferred.* In full, observed representations constitute evidence, and scientific identities are inferences derived from that evidence. Applied to the object of study: any statement about a journal's thematic *identity* must be constructed from an observed representation R_j and must never replace it. Identity is reported only as an inference explicitly conditioned on ⟨T, A⟩, the window, and the data snapshot; it is never asserted as an intrinsic property and never presented as a correction of the editorial classification.

**Derived objects.** The **thematic nucleus** N(R_j) is defined in §S2. From R_j and the journal's editorial category set E_j ⊆ T we define the three comparative descriptors — alignment (JCA), coverage (M), and position (D) — in §S2.

### Propositions

We separate propositions that are **deductive** (true by construction, given the framework) from those that are **empirical** (claims about the data, evaluated in the main text §6).

**Proposition 1 (existence, deductive).** Under Definitions 1–2, for every journal satisfying C the representation R_j exists and is unique given ⟨T, A, window, snapshot⟩.
*Proof.* A is a well-defined function of the finite multiset D_j: each mass is a ratio of finite non-negative counts with positive denominator (guaranteed by C), and the masses sum to one by construction. Uniqueness follows from A being a function. ∎

**Proposition 2 (derivability of descriptors, deductive).** The nucleus and the three descriptors are computable from R_j (and, for JCA/M/D, from E_j) without any appeal to a "true" identity.
*Proof.* Each is defined by an explicit deterministic operator on R_j (and E_j): the nucleus by a prefix-sum threshold (§S2), concentration and entropy by closed-form functionals, JCA by summation over E_j, coverage and position by set relations between N(R_j) and E_j. All are total functions on the domain where C holds. ∎

**Proposition 3 (non-redundancy of M and D, empirical).** Coverage and position are not deterministically related: knowing M does not determine D across the cohort. *Evaluated in §6.2.*

**Proposition 4 (separability of JCA, empirical).** Alignment is not a deterministic function of a journal's structural properties—editorial breadth (|E_j|), size (log number of works), and intrinsic shape (entropy or concentration): a non-trivial share of its cross-journal variance remains unexplained by these predictors. *Evaluated in §6.2.*

The deductive propositions guarantee that a *reproducible description* exists; every claim about what that description *reveals* is empirical and is held to the corresponding evidential standard. This boundary is the formal content of Principle 1.

---

## S2. Metric definitions against the canonical implementation

All quantities below are produced by a single canonical implementation (§S6). The definitions state the intended object; **the executable reference is the code**, and no third-party library routine is treated as equivalent without an explicit parity check. Verified points from the code-to-documentation audit (§S5) are noted inline.

**Mass distribution.** For mass mode `mode ∈ {p_doc, p_cit}`, `share[s] = mass[s] / Σ_t mass[t]`, over subfields with `mass[s] > 0`. Empty or zero-total distributions are excluded by C.

**Nucleus.** Sort subfields by decreasing share (ties broken by ascending subfield identifier). Let `k* = min{ k : Σ_{i=1..k} share(i) ≥ τ }`, with `τ = 0.5`; the nucleus is `N = { s(1), …, s(k*) }`. The subfield whose inclusion first reaches or exceeds τ **belongs** to the nucleus. *(Audit: the code stops with `≥ τ` and includes the crossing subfield; the secondary sort key is the subfield identifier ascending.)*

**Concentration.** `TCI = Σ_s share[s]²` (equivalently the Herfindahl–Hirschman index of the distribution).

**Entropy.** `H = − Σ_s share[s] · ln share[s]`, using the **natural logarithm**; normalized entropy `H_norm = H / ln(k)` where k is the number of active subfields. *(Audit: entropy uses `ln`.)*

**Jensen–Shannon divergence.** For distributions p, q with mean `m = ½(p + q)`, `JSD(p, q) = ½ KL(p‖m) + ½ KL(q‖m)` with the Kullback–Leibler terms in **base 2** and the convention `0·log 0 = 0`; the two vectors are aligned on the union of their supports. The reported quantity is the **divergence** (bounded in [0, 1] for base-2), **not** its square root. *(Audit: `jsd()` returns the base-2 divergence, not the Jensen–Shannon distance; `scipy.spatial.distance.jensenshannon` — which returns the square-root distance — is **not** an equivalent substitute.)*

**Comparative descriptors** (require E_j; comparable cohort only):
- **Alignment**, `JCA = Σ_{s ∈ E_j} p_cit[s]` — the citation-weighted mass of R_j falling within the editorial categories.
- **Coverage**, `M` — the share of the nucleus intrinsically accounted for: \(M_j = (\sum_{s \in K_j \cap E_j} p^{\mathrm{cit}}_{j,s}) / (\sum_{s \in K_j} p^{\mathrm{cit}}_{j,s})\), with nucleus \(K_j\) by cumulative mass \(\tau = 0.5\) on \(p^{\mathrm{cit}}\) (`spec_MD_cientifica.md`; `md_intrinsecos.py`).
- **Position**, `D ∈ {nuclear, peripheral, displaced}` — with \(m_E = \sum_{s \in E_j} p^{\mathrm{cit}}_{j,s}\): **displaced** if \(m_E < \varepsilon\) (\(\varepsilon = 0.05\)); **nuclear** if \(m_E \ge \varepsilon\) and at least 50% of \(m_E\) falls in \(K_j\) (`FRAC_CORE_NUC = 0.50`); **peripheral** if \(m_E \ge \varepsilon\) and less than 50% of \(m_E\) falls in \(K_j\) (`spec_MD_cientifica.md`; `md_intrinsecos.py`).

**Impact.** `JSS` — a subfield-normalized citation score read directly from the pipeline (`discovery_cite_metrics`); not re-derived here.

**Temporal stability.** `S = 1 − mean_t JSD(p_doc_t, p_doc_{t+1})` over consecutive years, on the **document-weighted** distribution to avoid citation-lag bias.

**Window comparison** (per journal, either mode): mass divergence `JSD(R^A, R^B)`; nucleus similarity `Jaccard(N^A, N^B)`; dominant-subfield persistence `argmax R^A = argmax R^B`; and the cross-journal Pearson (and Spearman) correlations of TCI, H, and H_norm between windows. Eligibility for a comparison requires at least `MIN_SUBFIELDS = 3` active subfields in each window; the common panel is the intersection of eligible journals.

---

## S3. Cohort construction

The cohort is built provenance-first from OpenAlex sources. Eligibility for the **sampling frame** requires a calculable subfield-normalized impact, an ISSN present in the Scopus title list, and sufficient content; this yields **1,461** journals across six subfields. The **comparable cohort** (**521**) additionally satisfies the conditions for editorial comparison (an effective editorial classification is available). The **analytic cohort** (**522**) adds one journal retained solely as an illustrative example and excluded from all aggregate estimates and from the descriptor matrix.

Two inference domains follow and are never conflated: descriptor/typology analyses (JCA, M, D) use the comparable cohort (521); intrinsic-representation analyses (concentration, stability, perturbations) use the analytic cohort (522). Reported cohort sizes are recorded per run in its manifest; no cohort size is hard-coded in the computation. *(Cross-reference: Figure 2.)*

---

## S4. Preregistration

Two protocols were fixed, versioned, and frozen **before** the corresponding results were observed.

### S4.1 Forward temporal replication (`p_cit`)
Frozen before execution: the metrics; the reference values inherited from the backward replication; the decision thresholds; and the four-cell verdict rule. A perturbation-magnitude diagnostic was added, also in advance, and its output is mandatory.

**Thresholds** (inherited from the backward replication A): `PISO_JSD = 0.056`, `PISO_DOM = 0.792`, `TECHO_FORMA = 0.95`, `τ = 0.5`, `MIN_SUBFIELDS = 3`, and the reference vector `REF_A = {JSD 0.046, Jaccard 1.00, dominant 0.822, TCI 0.83, H 0.90, H_norm 0.76}`.

**Verdict rule (frozen four-cell grid).** With
`estruct_ok = (jsd_median ≤ PISO_JSD) ∧ (jaccard_median ≥ 1−ε ∧ jaccard_pct≥0.90 ≥ 0.90) ∧ (dominant_pct ≥ PISO_DOM)` and
`forma_techo = min(TCI_r, H_r, Hnorm_r) > TECHO_FORMA`:

| `estruct_ok` | `forma_techo` | Verdict |
|---|---|---|
| true | true | INCONCLUSIVE |
| true | false | REPRODUCES ASYMMETRY |
| false | true | CONTRADICTS |
| false | false | **WEAKENS** |

No exploratory threshold tuning was performed after observing the data; the verdict follows mechanically from this grid. A verdict is registered whatever the outcome. The observed forward-`p_cit` result lands in `WEAKENS` (main text §6.4).

### S4.2 Documentary control (`p_doc`)
Because the citation-calibrated grid of §S4.1 is not valid for a document-weighted metric, the documentary control uses a **separately preregistered** classification by comparison to two empirical anchors — the stable backward result and the reorganized forward-`p_cit` result — evaluated on the common panel:

```
A_CONFIRMATORY:  JSD_pdoc ≥ 0.071  AND  Jaccard≥0.90_pdoc ≤ 0.60
B_MATURATION:    JSD_pdoc ≤ 0.046  AND  Jaccard≥0.90_pdoc ≥ 0.90
INCONCLUSIVE:    any other case (intermediate region, or metrics disagree)
```
Bounds are inclusive; both metrics must indicate the same scenario, and any disagreement yields INCONCLUSIVE. The classification is a comparison against `p_cit` anchors, **not** a same-mode verdict; a formal same-mode verdict would require an anchor computed on `p_doc`. The observed documentary result is **INCONCLUSIVE** (main text §6.4, Figure 5).

### S4.3 Frozen package identifiers
| Artifact | SHA-256 |
|---|---|
| Preregistration — forward replication (`preregistro_pruebaA_prima.md`) | `e08ce26c0a8f39b05d05aa1c1667301e79160810c5f8692f036b8862b648b982` |
| Canonical analysis script | `08a0e48a293096f329caed0f85ce6806b49065b4974f4f807e970747ae838769` |
| Manifest (`p_cit`) | `9fb560d7d53722a16125181f598cf678c2d1664ee055cacc5d39bd1322ed73ea` |
| Manifest (`p_doc`) | `70d1ae785a4effd759d04de984228ff989f0fb5a7cfe674914636aa197ac86b4` |
| Runbook (`p_doc` replication; documentary-control protocol) | `36b3a95e3ec44536084aeab71bf91155cc2512a96500584db04a242e2f678363` |

---

## S5. Code-to-documentation audit

Before executing the documentary control, the canonical implementation was audited against this Supplementary Material and the frozen protocols. The audit reads functions and constants **by symbol** (not by line), records the environment and input snapshot, and classifies any reproduction failure as code / data / environment / unresolved drift. Result: **PASS**, with no drift.

Verified points (abridged): the nucleus rule (`≥ τ`, crossing subfield included; tie-break by subfield identifier ascending); the JSD (base-2 divergence, not distance); the entropy base (`ln`); the constants and reference vector; the frozen verdict grid and its four labels; eligibility and the common-panel construction; the perturbation diagnostic; the form correlations (Pearson and Spearman on the same panel); the absence of hard-coded cohort sizes in the computation; and integral reproduction of the frozen manifest at the individual-journal and aggregate levels (unexpected differences: 0; float tolerance `1e-12`). Three documentation corrections identified by the audit (nucleus defined solely by the cumulative-mass rule; explicit log bases; `ORDER BY` as optional plumbing) are incorporated in §S2.

**Identity of the audited artifacts.**
| Field | Value |
|---|---|
| Canonical script SHA-256 | `08a0e48a293096f329caed0f85ce6806b49065b4974f4f807e970747ae838769` |
| Canonical manifest SHA-256 | `9fb560d7d53722a16125181f598cf678c2d1664ee055cacc5d39bd1322ed73ea` |
| Environment lock SHA-256 | `3e5e937b316c05aeb0637b90687e4dd98182bc3581cb1c91017dbec46770305a` |
| Input snapshot identifier | `9844f2c9e1dedd7328b5299702591c7c26da6f29c39fc67bcb04b3b2e9814ff3` |
| Environment | Python 3.14.5 · numpy 2.5.1 · pandas 3.0.3 · scipy 1.18.0 · PostgreSQL 16.14 |

---

## S6. Reproducibility ledger

The analysis is released as a versioned, reproducible unit. Every reported number is traceable to the run that produced it through the identifiers below.

- **Repository:** ⟦URL⟧ — canonical implementation, materialization scripts, protocols, audit runner.
- **Archived deposit (Zenodo):** ⟦DOI⟧ — code, data manifests, preregistration documents, the audit report, and the SHA-256 identifier table.
- **Version identifiers:** the frozen manuscript, the preregistrations, the canonical script, the manifests, and the audit each carry a SHA-256 hash (tables in §S4.3 and §S5); the manuscript version register (`VERSIONS.md`) records them and the outcome of each execution.

Reproduction procedure: instantiate the environment (§S5), point the pipeline at the archived snapshot, and re-run the canonical script; the regression gate reproduces the frozen manifest before any new analysis is permitted.

---

## S-Figures / S-Tables

**Table S1.** Subfield composition of the cohort (sampling frame = `in_content` on Path-1 six; source: `journal_frame_index`).

| Subfield code | Sampling frame (`in_content`) | Comparable (`frame_status='comparable'`) |
|---|---:|---:|
| 1311 | 83 | 49 |
| 2604 | 130 | 53 |
| 2716 | 6 | 1 |
| 3106 | 50 | 25 |
| 3109 | 28 | 8 |
| 3312 | 1164 | 385 |
| **Total** | **1461** | **521** |

**Table S2.** Reproduction diff from the code-to-documentation audit (`audit_A_prima_consistency/audit_consistency_report.json`, control `10_manifiesto`): unexpected aggregate differences = **0**; unexpected individual (per-journal) differences = **0**; float tolerance = `1e-12`.

- **Figure S1.** Continuous vs threshold-based observables — a schematic of how a nucleus set can turn over under a mass change too small to move the divergence (the operator-decoupling made explicit for §7).
- **Figure S2.** Perturbation-magnitude diagnostic (distribution of per-journal divergences under the forward replication).

*Draft v1 · Supplementary Material · definitional + reproducibility reference · remaining placeholders: repository URL and Zenodo DOI (pending deposit).*
