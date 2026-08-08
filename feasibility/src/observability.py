"""Q5, Q6, Q10 - input availability for identity and competitive variables.

Q5  historical position *inputs* (no position computed);
Q6  category system and its temporality (marginal counts only);
Q10 effective longitudinal observability, split identity / competitive / joint.

The defining discipline of this module: it measures *where the inputs exist*,
never what the variables built from them do. No identity object, no competitive
position, no lag is computed anywhere here.
"""

from __future__ import annotations

import pandas as pd

from .io_snapshot import Snapshot
from .config import OBSERVABILITY_BUCKETS

# --- Q5 ---------------------------------------------------------------------
Q5_COLUMNS = [
    "start_year", "window_length", "step",
    "share_works_with_citation_count",
    "maturation_median_citations_by_age",   # citation-maturation curve summary
    "reference_set_definition_available",
    "within_reference_set_percentile_inputs_available",  # inputs only; no position built
]


def q5_position_inputs(snap: Snapshot) -> pd.DataFrame:
    """Per window: citation-count availability, the citation-maturation curve,
    and confirmation that all inputs for later within-reference-set
    percentiles/quartiles exist -- WITHOUT computing any journal-level
    competitive position now. Returns columns Q5_COLUMNS.
    """
    raise NotImplementedError("Implement against the pinned snapshot; inputs only, no position.")


# --- Q6 ---------------------------------------------------------------------
# A snapshot classification applied retrospectively must not be described as a
# 'category system across years'. This tag records which case each source is in.
CATEGORY_TEMPORALITY = ("historical", "snapshot-retrospective", "mixed")

Q6_COLUMNS = [
    "publication_year", "n_categories",
    "categories_per_journal_p50", "categories_per_journal_p90",
    "category_assignment_temporality",  # one of CATEGORY_TEMPORALITY
]


def q6_categories(snap: Snapshot) -> pd.DataFrame:
    """Category-system availability/stability by year, the marginal
    categories-per-journal distribution, and the temporality tag.
    Returns columns Q6_COLUMNS.
    """
    raise NotImplementedError("Implement against the pinned snapshot; marginal counts only.")


# --- Q10 --------------------------------------------------------------------
# Reported as depth buckets (>= n comparable windows), not chosen lags.
_bucket_cols = [f"journals_with_ge_{n}_windows" for n in OBSERVABILITY_BUCKETS]
Q10_COLUMNS = ["start_year", "window_length", "step", *_bucket_cols]


def _q10_generic(snap: Snapshot, panel: str) -> pd.DataFrame:
    """Shared shape for the three observability panels. `panel` is a label only
    ('identity' | 'competitive' | 'joint_inputs'); it selects which input-
    availability mask defines a 'usable' window, and computes the max number of
    comparable windows per journal -> depth-bucket counts. No I, no P, no lag.
    """
    raise NotImplementedError("Implement against the pinned snapshot; depth buckets only.")


def q10_observability_identity(snap: Snapshot) -> pd.DataFrame:
    """Depth buckets where identity *inputs* are available. Columns Q10_COLUMNS."""
    return _q10_generic(snap, "identity")


def q10_observability_competitive(snap: Snapshot) -> pd.DataFrame:
    """Depth buckets where competitive *inputs* are available. Columns Q10_COLUMNS."""
    return _q10_generic(snap, "competitive")


def q10_observability_joint_inputs(snap: Snapshot) -> pd.DataFrame:
    """Depth buckets where the inputs to BOTH variables are simultaneously
    available -- the intersection that bounds the true horizon for later tests.
    Contains no I and no P. Columns Q10_COLUMNS.
    """
    return _q10_generic(snap, "joint_inputs")
