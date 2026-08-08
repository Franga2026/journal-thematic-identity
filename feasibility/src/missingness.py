"""Q8 - missingness map, restricted to EXOGENOUS covariates.

Per data element (venue, subfield, citations, references, category): missingness
by year, and whether that missingness is structured. Per the v1.1 restriction,
structuring may be examined ONLY along exogenous bibliographic-coverage axes
(discipline, size band, region, year). It must never be examined along
reconstructed thematic architecture, competitive position, or any variable later
defined as an H2/Test-H moderator -- that would open a peeking channel.
"""

from __future__ import annotations

import pandas as pd

from .io_snapshot import Snapshot

# Only these exogenous strata may be used to test whether missingness is structured.
ALLOWED_STRATA = ("discipline", "size_band", "region", "publication_year")

Q8_COLUMNS = [
    "element", "publication_year", "share_missing",
    "structured_by_stratum", "stratum_name",  # stratum_name in ALLOWED_STRATA only
]


def q8_missingness(snap: Snapshot) -> pd.DataFrame:
    """Per-element missingness by year + structured-missingness flag along an
    ALLOWED_STRATA axis only. Returns columns Q8_COLUMNS.
    """
    raise NotImplementedError("Implement against the pinned snapshot; exogenous strata only.")
