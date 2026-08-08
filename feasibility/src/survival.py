"""Q2 - journal survival vs. span, reported for BOTH panels.

Balanced: journals meeting min_docs in *every* window of the span.
Unbalanced: journals meeting min_docs in *at least K consecutive* windows.
Reporting both is mandatory, to expose survivorship bias (protocol section 4/Q2).
No panel is chosen here; both are tabulated across the design-probing grid.
"""

from __future__ import annotations

import pandas as pd

from .io_snapshot import Snapshot

Q2_BALANCED_COLUMNS = [
    "start_year", "window_length", "step", "min_docs_per_window",
    "span_years", "n_windows", "n_journals_balanced",
]

Q2_UNBALANCED_COLUMNS = [
    "start_year", "window_length", "step", "min_docs_per_window",
    "span_years", "n_windows", "min_consecutive_windows_K", "n_journals_unbalanced",
]


def q2_survival_balanced(snap: Snapshot) -> pd.DataFrame:
    """Balanced-panel counts across the grid. Returns columns Q2_BALANCED_COLUMNS."""
    raise NotImplementedError("Implement against the pinned snapshot; counts only.")


def q2_survival_unbalanced(snap: Snapshot) -> pd.DataFrame:
    """Unbalanced-panel counts (>= K consecutive windows), K probed.
    Returns columns Q2_UNBALANCED_COLUMNS.
    """
    raise NotImplementedError("Implement against the pinned snapshot; counts only.")
