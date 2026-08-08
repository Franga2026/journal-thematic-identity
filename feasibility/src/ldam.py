"""Q9 synthesis + the Longitudinal Data Availability Manifest (LDAM).

Q9 combines Q1-Q8 and Q10 into one outcome-blind decision table. The LDAM binds
the authorizing protocol, the executing code, the source snapshot, and the
produced outputs into one sealed, hashable record (protocol sections 6 and 10).

The manifest deliberately records the protocol's OWN SHA-256 as its first field,
so the chain 'protocol -> code -> snapshot -> outputs -> decision' has no
implicit link.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from .config import ROOT, PROTOCOL_FILENAME, PROTOCOL_SHA256, SnapshotConfig
from .io_snapshot import Snapshot

Q9_COLUMNS = [
    "candidate", "span_years", "window_length", "min_docs_per_window",
    "n_balanced", "n_unbalanced",
    "thematic_coverage", "competitive_maturation", "venue_integrity",
    "observability",  # qualitative rollups; no JSD, no change, no coupling p-values
]


def q9_feasibility_decision_table(snap: Snapshot) -> pd.DataFrame:
    """Assemble the outcome-blind decision table from the other permitted
    outputs. Contains no identity change, no 88/12, no position change, no
    H1-H4, no coupling p-values. Returns columns Q9_COLUMNS.
    """
    raise NotImplementedError("Assemble from q1..q8 and q10 aggregates; structure only.")


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def script_hashes() -> dict[str, str]:
    """SHA-256 of every Pipeline A source file (the 'executing code' link)."""
    src = ROOT / "src"
    files = sorted(list(src.rglob("*.py")) + [ROOT / "run_phase0.py", ROOT / "ci" / "firewall_check.py"])
    return {str(p.relative_to(ROOT)): _sha256_file(p) for p in files if p.exists()}


def build_ldam(cfg: SnapshotConfig, contamination_log: list[dict] | None = None) -> dict:
    """Assemble the LDAM dict. Written via writers only after the firewall CI passes.

    ``run_timestamp_utc`` is stamped at build time by the operator's environment
    (not in this scaffold), so no fabricated time is embedded here.
    """
    return {
        "authorizing_protocol": {
            "filename": PROTOCOL_FILENAME,
            "sha256": PROTOCOL_SHA256,   # first link, made explicit
            "version": "v1.1",
            "status": "frozen",
        },
        "snapshot": {
            "date": cfg.snapshot_date,
            "taxonomy_version": cfg.taxonomy_version,
            "subfield_vocabulary_sha256": cfg.subfield_vocabulary_sha256,
            "source_name": cfg.source_name,
        },
        "executing_code": script_hashes(),
        "run_timestamp_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "produced_outputs": "see feasibility/out/ (Q1-Q10 aggregate tables)",
        "contamination_log": contamination_log or [],
        "phase": "Phase 0 (feasibility) - outcome-blind",
        "git_commit": None,  # by design; the commit will contain this manifest
    }


def write_ldam(cfg: SnapshotConfig, contamination_log: list[dict] | None = None) -> Path:
    from . import writers

    return writers.write_permitted_json(
        build_ldam(cfg, contamination_log), "ldam_manifest.json"
    )
