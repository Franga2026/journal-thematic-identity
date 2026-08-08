"""Q1 (temporal comparability of coverage) and Q4 (historical identity inputs).

Both are marginal, year-conditional availability tables. Neither builds a
per-journal topic distribution or an analysis object; they report only how
completely the inputs exist, by publication year.
"""

from __future__ import annotations

import pandas as pd

from .config import COVERAGE_FLOOR_YEAR
from .io_snapshot import Snapshot

Q1_COLUMNS = [
    "publication_year",
    "n_works",
    "share_with_venue_id",
    "share_with_subfield",
    "share_with_abstract",
    "share_with_references",
    "median_references_per_work",
]

Q4_COLUMNS = [
    "publication_year",
    "share_with_subfield_assignment",
    "share_with_abstract_metadata",
    "share_with_reference_metadata",
    "subfield_vocabulary_size_populated",
    "single_taxonomy_version_confirmed",
]


def q1_coverage_by_year(snap: Snapshot) -> pd.DataFrame:
    """Per publication year: totals and coverage shares (marginal only)."""
    df = snap.works_availability()
    if df.empty:
        return pd.DataFrame(columns=Q1_COLUMNS)

    # Map pilot column names to protocol semantics
    work = df.copy()
    if "has_venue_id" not in work.columns and "has_source" in work.columns:
        work["has_venue_id"] = work["has_source"].astype(bool)
    for col in (
        "has_venue_id",
        "has_subfield",
        "has_abstract",
        "has_references",
    ):
        work[col] = work[col].fillna(False).astype(bool)
    work["referenced_works_count"] = (
        work["referenced_works_count"].fillna(0).astype(int)
    )
    work["publication_year"] = work["publication_year"].astype(int)

    # Population: keep all rows in the bound substrate (pilot already filtered).
    # Document-type filter for Papers 1-2 is deferred; pilot records raw types.
    ymin = max(int(work["publication_year"].min()), COVERAGE_FLOOR_YEAR)
    ymax = int(work["publication_year"].max())
    years = list(range(ymin, ymax + 1))

    rows = []
    for y in years:
        sub = work[work["publication_year"] == y]
        n = int(len(sub))
        if n == 0:
            rows.append(
                {
                    "publication_year": y,
                    "n_works": 0,
                    "share_with_venue_id": 0.0,
                    "share_with_subfield": 0.0,
                    "share_with_abstract": 0.0,
                    "share_with_references": 0.0,
                    "median_references_per_work": 0.0,
                }
            )
            continue
        rows.append(
            {
                "publication_year": y,
                "n_works": n,
                "share_with_venue_id": round(float(sub["has_venue_id"].mean()), 6),
                "share_with_subfield": round(float(sub["has_subfield"].mean()), 6),
                "share_with_abstract": round(float(sub["has_abstract"].mean()), 6),
                "share_with_references": round(float(sub["has_references"].mean()), 6),
                "median_references_per_work": float(
                    sub["referenced_works_count"].median()
                ),
            }
        )

    out = pd.DataFrame(rows, columns=Q1_COLUMNS)
    # Stable float formatting for CSV via writers (pandas will write floats)
    return out


def q4_identity_inputs_by_year(snap: Snapshot) -> pd.DataFrame:
    """Year-conditional assignment coverage — not implemented in the Q1 pilot."""
    raise NotImplementedError("Q4 is out of scope for the one-partition Q1 pilot")
