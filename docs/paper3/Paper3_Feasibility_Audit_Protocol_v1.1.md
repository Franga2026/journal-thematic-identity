# Paper 3 — Longitudinal Feasibility Audit Protocol v1.1
### Outcome-blind, pre-preregistration — sealing candidate
*Study (working title): "Dynamic Coupling Between Journal Thematic Identity and Competitive Position: A Longitudinal Analysis." Governs the feasibility phase only (Phase 0). Tests, estimates, and inspects nothing bearing on H1–H4 or Tests E–I. Supersedes v1.0.*

---

## 0. Purpose and standing

Phase 0 determines **whether — and over what temporal span — the longitudinal design is executable at all**, using only facts about data availability and structure: *given the data we can actually obtain, over how many comparable windows, how many journals, at what per-journal document density and data quality, can Paper 3 be built?*

Phase 0 is **not a hypothesis test** and is not preregistered as one. It is **documented and sealed as an input** to the preregistration: its snapshot identifier, scripts, and aggregate output tables are hash-pinned so the sealed protocol can cite the exact factual basis on which universe, windows, and thresholds are later frozen.

---

## 1. The firewall — three levels

### 1.1 Conceptual blinding rules

The audit **may** compute, per journal *j*, publication year *y*, candidate window *t*: availability/coverage indicators; counts and survival; and marginal, univariate data-quality distributions.

The audit **must NOT** compute, output, or inspect — for any journal or in aggregate — the identity vector I(j,t) as an analysis object; its change/drift or autocorrelation; the position trajectory P(j,t) beyond *availability of its inputs*; **any** relationship between I and P (cross-lagged, contemporaneous, directional); or any Test E–I statistic, lag, persistence contrast, or susceptibility stratification of an effect.

> **In one line:** the audit measures whether we can *build* the variables, never what the variables *do to each other*. Anyone reading the audit outputs must be unable to infer the sign or existence of coupling.

### 1.2 Software-level separation

Two physically separate pipelines and directories:

- **Pipeline A — Feasibility** (`/feasibility/`): `data → coverage → density → survival → missingness → integrity → observability → LDAM`. The only code executed in Phase 0.
- **Pipeline B — Preregistered analysis** (`/analysis/`): `sealed snapshot → I(j,t) + P(j,t) → E–I`. **Created but locked** (no analysis code) until the preregistration is sealed.

Enforcement for Pipeline A: (1) it **must not contain, import, or be able to call** any function capable of longitudinal Jensen–Shannon divergence, nucleus/turnover, journal-level quartile assignment over time, change-on-change regression, cross-correlation/cross-lag, or persistence classification — asserted by a lint/CI check; (2) it **must not write** any per-journal, per-window thematic distribution vector or position value; (3) the permitted/prohibited output list of §8 is fixed and sealed.

### 1.3 Phase-0 contamination rule *(new in v1.1)*

> **Phase-0 contamination rule.** If Pipeline A computes or exposes any prohibited outcome-bearing quantity defined in §8, Phase 0 is considered contaminated. The incident, affected artifacts, and exposure are logged; contaminated outputs cannot be used as the evidentiary basis for the preregistration. A clean rerun from the sealed source snapshot is required, with the contamination event retained in the provenance record.

We do not pretend human error is impossible; we define *in advance* what happens if it occurs. The contamination log is part of the sealed provenance.

---

## 2. Non-decisional status of all audit parameters

> **All grid values used during the feasibility audit are design-probing parameters only. Their inclusion in the audit does not constitute analytical selection or preregistration. No candidate value acquires privileged status until it is selected and justified in the subsequent sealed preregistration.**

Scope: every start year, window length, step, minimum-document floor, minimum-consecutive-window count, and effective end year appearing anywhere in Phase 0.

---

## 3. Data elements to obtain

Recorded against a single fixed source snapshot; its **snapshot date and taxonomy version are the first line of the manifest.**

**Per work**: work id; publication year; host venue/source id; ISSN-L; subfield/topic assignment(s) with score; cited-by count; a citation-age proxy (citations within *n* years of publication, if reconstructable); referenced-works count; document type (for the article/review filter of Papers 1–2); language; presence flags for the metadata the classifier consumes (abstract, references).

**Per venue/source**: source id; ISSN-L set and its changes over time; display-name history; works count per year; publisher/host-organization history; predecessor/successor lineage where available; assigned subject categories, **each tagged with `category_assignment_temporality ∈ {historical, snapshot-retrospective, mixed}`** (Q6).

**Per snapshot**: snapshot date; topic-taxonomy version; full subfield vocabulary (fixed identity coordinate system, hashed); reference-set/category system in force.

---

## 4. Audit questions Q1–Q10

Each is factual and outcome-blind; beside each is the design element it *confirms is constructible* — never tests.

**Q1 — Temporal comparability of coverage.** Per publication year back to a generous floor: total works; share with venue id; share with ≥1 subfield; share with abstract; share with references; median references/work. → earliest year with comparable coverage.

**Q2 — Journal survival vs. span (balanced AND unbalanced).** Over the grid (start_year × window_length × step × min_docs), report two panels: **balanced** (meets `min_docs` in *every* window of the span) and **unbalanced** (meets `min_docs` in *at least K consecutive* windows, K probed). Reporting both is mandatory, to expose survivorship bias. No panel is chosen in Phase 0.

**Q3 — Per-window document density.** Aggregate distribution of documents/window; fraction below each `min_docs` candidate; per-journal minimum-window density **reported only in aggregate form**. Any journal×window count table is an intermediate artifact governed by the restricted-artifact rule in §8. → informs the future `min_docs` floor and estimation-reliability guard.

**Q4 — Historical identity representation (mandatory year-conditional outputs).** A single taxonomy version applied across all years gives common coordinates but does **not** by itself guarantee comparability. Mandatory outputs: **subfield-assignment coverage conditional on publication year**; completeness of the classifier's input metadata (abstract, references) **by year**; explicit confirmation that exactly one taxonomy version is present. → confirms I(j,t) is computable on constant coordinates; surfaces differential-coverage risk for old works (Paper 2 §7 caveat).

**Q5 — Historical position *inputs* (no P computed).** Per window: share of works with citation counts; the **citation-maturation curve** (median citations vs. document age); availability of the reference-set definition; and, deliberately reworded: *availability of all inputs required for subsequent computation of within-reference-set percentiles/quartiles, without computing journal-level competitive positions during the audit.*

→ confirms P(j,t) will be computable later and quantifies recent-window immaturity, while computing **no** journal position now.

**Q6 — Category system and its temporality.** Availability and stability of categories across years; number of categories; **distribution of categories-per-journal** (marginal counts only — the multi-reference-set exposure that H2/Test H will later stratify on). Record for the source used the tag `category_assignment_temporality = historical | snapshot-retrospective | mixed`, distinguishing (A) categories a journal *has in the snapshot* from (B) categories it *actually held historically*. A snapshot classification applied retrospectively must **not** be described as a "category system across years." → protects H2 from a hidden anachronism.

**Q7 — Venue identity integrity.** Among candidate journals across the span: counts of ISSN-L changes, renames, merges, splits, publisher transfers, and how source ids map through them. → determines identity reconciliation vs. exclusion.

**Q8 — Missingness map.** Per element (venue, subfield, citations, references, category): missingness by year; whether missingness is structured. **Restriction (new in v1.1):** *structured-missingness diagnostics are restricted to exogenous bibliographic coverage covariates and must not use reconstructed thematic architecture, competitive position, or any variable subsequently defined as an H2/Test H susceptibility moderator.*

→ feeds exclusion rules and the sensitivity plan without opening a peeking channel into H2.

**Q10 — Effective longitudinal observability (identity, competitive, and joint).** *(Substantive addition; split in v1.1.)* Fifteen calendar years are not fifteen usable years for a design with multi-year windows and history requirements. For each (span × window_length × step), compute the **maximum number of comparable windows available per journal** and how many journals possess enough history to later support depth of varying length — **without computing any I or P variable and without testing any lag** — separately for:
- the **identity** panel (`q10_observability_identity.csv`),
- the **competitive** panel (`q10_observability_competitive.csv`), and
- the **joint-inputs** panel (`q10_observability_joint_inputs.csv`): *in how many windows are the inputs required to build both variables simultaneously available?* — this file contains no I and no P.

Reported as depth buckets, not chosen lags:

| Comparable windows available | Journals |
|---|---|
| ≥ 3 | N |
| ≥ 5 | N |
| ≥ 7 | N |
| ≥ 10 | N |

> **The true horizon for Tests F–I is bounded by the *intersection* of identity and competitive observability, not by the longer panel.** We may find 20 usable years for identity but only 14 for position; the joint-inputs file makes that binding limit explicit.

**Q9 — Feasible-panel synthesis (evaluated last).** Named to signal that it is the synthesis of Q1–Q8 and Q10, not a numbering error. Combines all questions into one outcome-blind decision table (§9). Contains **no** JSD, identity change, 88/12, position change, H1–H4, or coupling p-values.

---

## 5. Candidate grid (design-probing only) and effective end year

- **start_year**: {2005, 2010, 2012, 2015}
- **window_length**: {3, 4} years
- **step**: 1 year (overlapping windows, consistent with the D design)
- **min_docs_per_window**: {25, 50, 100}
- **effective end year**: **not** "the last available year." Determined by maturation: if recent works have citations too immature to support P, the audit reports the latest year at which the *competitive* panel is defensible. Reported **separately** for the identity panel and the competitive panel (which may end in different years); the joint horizon follows Q10.

The audit reports the whole grid; it selects no cell. Selection and justification occur only in the sealed preregistration.

---

## 6. Deliverables of Phase 0

1. **Longitudinal Data Availability Manifest (LDAM)** — **SHA-256 of this sealed protocol (v1.1)** + snapshot date + taxonomy version + subfield-vocabulary hash + script hashes + run timestamp + Q1–Q10 aggregate tables + contamination log (if any), SHA-256 sealed. Recording the protocol's own hash inside the LDAM binds *the document that authorized the audit* to *the outputs the audit produced*.
2. **Feasibility memo (2–3 pp)** — maximum defensible span(s) for identity, competitive, and joint panels, with tradeoffs; no outcome content.
3. **Data-requirements checklist** — every §3 element confirmed obtainable, or named missing.
4. **Decision table** (§9).

None reveals anything about coupling; all can be archived or shared without compromising the preregistration.

---

## 7. What is deferred to the preregistration

Universe; balanced vs. unbalanced panel; windows; identity representation; competitive representation; definitions of change / persistence / drift / susceptibility; lags; thresholds; exclusions; missingness handling; Tests E–I; controls; placebos; sensitivity analyses; decision criteria; mandatory outputs; manifest; SHA-256 sealing protocol. Phase 0 reports only **which of these are constructible and over what span**.

---

## 8. Exact I/O and permitted/prohibited files

**Directory layout**
```
/feasibility/                 (Pipeline A — the only code run in Phase 0)
    src/                      (coverage, density, survival, missingness, integrity, observability)
    out/                      (permitted outputs only)
    tmp_restricted/           (intermediate granular artifacts; see restricted-artifact rule)
    ldam_manifest.json        (the sealed manifest file)

/analysis/                    (Pipeline B — LOCKED: empty of code until preregistration sealed)
```
*(`/feasibility/` and `/analysis/` are two distinct top-level roots; `ldam_manifest.json` lives inside `/feasibility/`.)*

**Permitted outputs** (aggregate/marginal only):
- `ldam_manifest.json` — snapshot date, taxonomy version, vocabulary hash, script SHA-256s, timestamp, contamination log.
- `q1_coverage_by_year.csv`
- `q2_survival_balanced.csv` · `q2_survival_unbalanced.csv`
- `q3_density.csv` (aggregate quantiles + share_below per min_docs)
- `q4_identity_inputs_by_year.csv`
- `q5_position_inputs.csv` (**no computed positions**)
- `q6_categories.csv` (includes `category_assignment_temporality`)
- `q7_venue_integrity.csv`
- `q8_missingness.csv`
- `q10_observability_identity.csv` · `q10_observability_competitive.csv` · `q10_observability_joint_inputs.csv`
- `q9_feasibility_decision_table.csv`

**Restricted-artifact rule (Q3 clarification, new in v1.1).** Journal×window count tables may exist **only** as an intermediate artifact of Pipeline A, inside `tmp_restricted/`. They are **not** part of the public LDAM. On completion of Phase 0 they are **deleted** after the aggregates are produced (preferred), or, if retained for debugging, sealed as a restricted input and excluded from any shareable output. The less granular material survives Phase 0, the stronger the firewall.

**Prohibited outputs** (presence of any is a §1.3 contamination event): any per-journal or per-journal-window **subfield/topic distribution vector**; any **I(j,t)** or **P(j,t)** value; any journal quartile over time; any **JSD**, nucleus, turnover, drift, change-on-change, cross-lag, coupling, or persistence-effect artifact.

**Prohibited functions/symbols in Pipeline A** (CI assertion): `jensen_shannon`/`jsd`, `nucleus`/`turnover`, journal-level `rank_to_quartile` over time, `cross_correlation`/`cross_lag`, `persistence_classify`, any `change ~ change` estimator.

---

## 9. Target final table (outcome-blind)

| Candidate | Span | Window | N balanced | N unbalanced | Min docs | Thematic coverage | Competitive maturation | Venue integrity | Observability |
|---|---|---|---|---|---|---|---|---|---|
| A | 20 y | 4 y | … | … | 25 | adequate | problematic | adequate | high |
| B | 15 y | 4 y | … | … | 50 | high | adequate | high | high |
| C | 10 y | 3 y | … | … | 100 | very high | high | high | medium |

No JSD. No identity change. No 88/12. No position change. No H1/H2/H3/H4. No coupling p-values. On structure and availability **alone**, the team then selects (e.g.) design B — and only then seals the preregistration.

---

## 10. Sealing sequence (Phase 0 → preregistration)

1. Freeze this document as **v1.1** → compute its **SHA-256** → commit.
2. Fix the **bibliographic snapshot**; record snapshot date.
3. Hash the **subfield vocabulary / taxonomy version**.
4. Implement **only** `/feasibility/`; leave `/analysis/` locked.
5. Run the **firewall CI** (prohibited-symbol assertion + prohibited-output check).
6. Execute **Q1–Q10**; produce the **LDAM**.
7. **Seal** the Phase-0 results (SHA-256; commit; contamination log attached).
8. **Only then** meet to select the longitudinal design from the decision table (§9).
9. Write and seal the **Paper 3 preregistration** (H1–H4 / Tests E–I).
10. **First-ever** construction of longitudinal I(j,t) and P(j,t) in Pipeline B.

**Provenance chain.** Sealing in this order records an explicit, verifiable chain: **the protocol that authorized the audit** (this document's SHA-256, step 1) → **the code that executed it** (script hashes, step 4–5) → **the snapshot it ran on** (snapshot date + vocabulary hash, steps 2–3) → **the outputs it produced** (Q1–Q10 aggregates in the LDAM, step 6) → **the decision it fed** (design selection, step 8). Because the protocol's own hash is stored inside the LDAM (§6), that first link is not implicit — the LDAM proves which authorizing document governed the run.

**Canonical master.** This Markdown file is the canonical text; its byte-exact content is what is hashed at step 1. The DOCX/PDF renderings are derived views only. Standalone callouts remain Markdown blockquotes deliberately; no stray blockquote markers survive inside the question definitions.

**Methodological consequence:** the choice of 10/15/20 years, 3/4-year window, 25/50/100 documents, balanced/unbalanced, and the effective horizon will be documentarily demonstrable as a decision driven by data availability and quality — not by which configuration produced the most attractive effect. That traceability is what distinguishes Paper 3 from a conventional bibliometric longitudinal study.

---

## 11. Project sequence (context)

Paper 2 (A→B→C′→D → separability of two properties) → **Paper 3 Phase 0: this audit → sealed LDAM → justified design selection → sealed preregistration → Pipeline B → Tests E (time-scales) → F (lagged coupling) → G (persistence) → H (susceptibility) → I (falsification) → interpretation.**

*This document knows nothing about the result Paper 3 later seeks. That is its purpose.*
