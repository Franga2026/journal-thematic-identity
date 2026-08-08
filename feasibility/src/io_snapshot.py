"""Snapshot loading interface (Phase 0).

Phase 0 draws every fact from ONE fixed snapshot whose date, taxonomy version,
and subfield-vocabulary hash are logged before any question runs. Returns only
neutral availability/structure elements of protocol section 3.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from .config import SnapshotConfig

_REPO = Path(__file__).resolve().parents[2]


class SnapshotHashMismatchError(RuntimeError):
    """On-disk bootstrap bytes no longer match the pinned sha256."""


@dataclass
class Snapshot:
    """Neutral views over the fixed snapshot (protocol section 3)."""

    cfg: SnapshotConfig
    _works_avail: pd.DataFrame | None = None

    def works_availability(self) -> pd.DataFrame:
        """Per-work availability flags/counts for Q1 (no thematic values)."""
        if self._works_avail is None:
            raise RuntimeError("works availability not bound")
        return self._works_avail.copy()

    def works(self) -> pd.DataFrame:
        """Alias used by older stubs; same as works_availability for the pilot."""
        return self.works_availability()

    def venues(self) -> pd.DataFrame:
        raise NotImplementedError("venues() not required for the Q1 pilot slice")

    def snapshot_meta(self) -> dict:
        return {
            "snapshot_date": self.cfg.snapshot_date,
            "taxonomy_version": self.cfg.taxonomy_version,
            "subfield_vocabulary_sha256": self.cfg.subfield_vocabulary_sha256,
            "source_name": self.cfg.source_name,
            "substrate": self.cfg.substrate,
            "notes": self.cfg.notes,
        }


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_snapshot(cfg: SnapshotConfig) -> Snapshot:
    """Return a Snapshot bound to the pinned config. Refuses an unpinned config."""
    if not cfg.is_pinned():
        raise RuntimeError(
            "Snapshot is not pinned (date / taxonomy version / vocabulary hash "
            "missing). Fix and hash the snapshot before Phase 0 (protocol section 10)."
        )

    if cfg.substrate == "works_pilot":
        if not cfg.bootstrap_works_path or not cfg.bootstrap_works_sha256:
            raise RuntimeError("works_pilot substrate requires bootstrap path + sha256")
        path = _REPO / cfg.bootstrap_works_path
        if not path.is_file():
            raise FileNotFoundError(path)
        got = _sha256_file(path)
        if got != cfg.bootstrap_works_sha256:
            raise SnapshotHashMismatchError(
                f"bootstrap sha256 mismatch: expected {cfg.bootstrap_works_sha256}, got {got}"
            )
        df = pd.read_parquet(path)
        # Expose only availability columns to Q1 (drop work_id from the frame
        # used for aggregation? keep for counting rows; Q1 aggregates by year)
        need = [
            "publication_year",
            "has_source",
            "has_subfield",
            "has_abstract",
            "has_references",
            "referenced_works_count",
        ]
        missing = [c for c in need if c not in df.columns]
        if missing:
            raise RuntimeError(f"bootstrap missing columns: {missing}")
        return Snapshot(cfg=cfg, _works_avail=df)

    # Default scaffold: pinned but unbound to a reader
    return Snapshot(cfg=cfg)
