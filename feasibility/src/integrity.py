"""Q7 - venue identity integrity across the span.

Counts of ISSN-L changes, renames, merges, splits, and publisher transfers among
candidate journals, and how source ids map through those events. Determines how
many journals need identity reconciliation vs. exclusion for the longitudinal
join. Pure structural bookkeeping; no identity or position is computed.
"""

from __future__ import annotations

import pandas as pd

from .io_snapshot import Snapshot

Q7_COLUMNS = [
    "source_id", "n_issnl_changes", "n_renames", "n_merges", "n_splits",
    "n_publisher_transfers", "reconciliation_status",  # {clean, reconcilable, exclude}
]


def q7_venue_integrity(snap: Snapshot) -> pd.DataFrame:
    """Per-source integrity-event counts + reconciliation status.
    Returns columns Q7_COLUMNS.
    """
    raise NotImplementedError("Implement against the pinned snapshot; structural counts only.")
