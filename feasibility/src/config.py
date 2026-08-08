"""Phase-0 configuration: design-probing grid and snapshot pinning.

Every value in ``GRID`` is a *design-probing parameter only* (protocol section 2).
Its presence here does not select or preregister anything. No candidate value
acquires privileged status until it is chosen and justified in the sealed
preregistration, which is a separate document written only after the LDAM.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "out"
RESTRICTED_DIR = ROOT / "tmp_restricted"

# Sealed authorizing protocol (recorded as the first field of the LDAM).
PROTOCOL_FILENAME = "Paper3_Feasibility_Audit_Protocol_v1.1.md"
PROTOCOL_SHA256 = "871b75fe47dd45d4a7249681996e178f4cf51acbcb8d345433fdfb729a53fdb8"

# --- design-probing grid (report every cell; select none) -------------------
GRID = {
    "start_year": [2005, 2010, 2012, 2015],
    "window_length": [3, 4],
    "step": [1],
    "min_docs_per_window": [25, 50, 100],
    "min_consecutive_windows_K": [3, 5, 7, 10],
}

OBSERVABILITY_BUCKETS = [3, 5, 7, 10]

COVERAGE_FLOOR_YEAR = 2000


@dataclass
class SnapshotConfig:
    """A single fixed bibliographic snapshot. Pinned before any question runs."""

    snapshot_date: str | None = None
    taxonomy_version: str | None = None
    subfield_vocabulary_sha256: str | None = None
    source_name: str | None = None
    notes: str = ""
    # Pilot / substrate binding (SliceSpec v0.2)
    substrate: str | None = None
    bootstrap_works_path: str | None = None
    bootstrap_works_sha256: str | None = None

    def is_pinned(self) -> bool:
        return all(
            v is not None
            for v in (
                self.snapshot_date,
                self.taxonomy_version,
                self.subfield_vocabulary_sha256,
            )
        )
