"""Q3 - per-window document density (aggregate only).

Reports the aggregate distribution of documents per window and the share of
journals below each candidate min_docs floor. Any journal x window count table
is a granular intermediate: it is written via writers.write_restricted to
tmp_restricted/ and purged after these aggregates exist (protocol section 8).
"""

from __future__ import annotations

import pandas as pd

from .io_snapshot import Snapshot

Q3_COLUMNS = [
    "start_year", "window_length", "step",
    "docs_per_window_p05", "docs_per_window_p25", "docs_per_window_p50",
    "docs_per_window_p75", "docs_per_window_p95",
    "share_below_min_docs_25", "share_below_min_docs_50", "share_below_min_docs_100",
]


def q3_density(snap: Snapshot) -> pd.DataFrame:
    """Aggregate documents-per-window quantiles + share-below each min_docs
    candidate, across the design-probing grid. Returns columns Q3_COLUMNS.

    Any per-journal, per-window count needed to derive these quantiles is a
    restricted intermediate and must not appear in the returned frame.
    """
    raise NotImplementedError("Implement against the pinned snapshot; aggregate only.")
