#!/usr/bin/env python3
"""Phase-0 orchestrator (Pipeline A).

Order of operations (protocol section 10, steps 4-7):
  1. Require the static firewall CI to pass before doing anything.
  2. Load the pinned snapshot (refuses if not pinned).
  3. Run Q1-Q10; every permitted output leaves through writers.write_permitted.
  4. Purge the granular intermediates in tmp_restricted/.
  5. Write the LDAM (with the protocol hash as its first field) and stop.

This wires the calls; the question bodies are unimplemented until the snapshot
is bound, so a run today halts at the first question by design. No outcome is
computed anywhere in this file.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from src import (
    coverage, density, survival, missingness, integrity, observability, ldam, writers,
)
from src.config import SnapshotConfig
from src.io_snapshot import load_snapshot

ROOT = Path(__file__).resolve().parent


def require_firewall_pass() -> None:
    """Run ci/firewall_check.py; abort Phase 0 unless it exits clean."""
    rc = subprocess.call([sys.executable, str(ROOT / "ci" / "firewall_check.py")])
    if rc != 0:
        raise SystemExit("Firewall check failed; Phase 0 aborted.")


def run(cfg: SnapshotConfig) -> None:
    require_firewall_pass()
    snap = load_snapshot(cfg)

    # Q1 / Q4 - coverage and identity inputs by year
    writers.write_permitted(coverage.q1_coverage_by_year(snap), "q1_coverage_by_year.csv")
    writers.write_permitted(coverage.q4_identity_inputs_by_year(snap), "q4_identity_inputs_by_year.csv")

    # Q2 - survival, both panels
    writers.write_permitted(survival.q2_survival_balanced(snap), "q2_survival_balanced.csv")
    writers.write_permitted(survival.q2_survival_unbalanced(snap), "q2_survival_unbalanced.csv")

    # Q3 - density (aggregate)
    writers.write_permitted(density.q3_density(snap), "q3_density.csv")

    # Q5 / Q6 - position inputs, categories
    writers.write_permitted(observability.q5_position_inputs(snap), "q5_position_inputs.csv")
    writers.write_permitted(observability.q6_categories(snap), "q6_categories.csv")

    # Q7 - venue integrity
    writers.write_permitted(integrity.q7_venue_integrity(snap), "q7_venue_integrity.csv")

    # Q8 - missingness (exogenous strata only)
    writers.write_permitted(missingness.q8_missingness(snap), "q8_missingness.csv")

    # Q10 - observability, three panels
    writers.write_permitted(observability.q10_observability_identity(snap), "q10_observability_identity.csv")
    writers.write_permitted(observability.q10_observability_competitive(snap), "q10_observability_competitive.csv")
    writers.write_permitted(observability.q10_observability_joint_inputs(snap), "q10_observability_joint_inputs.csv")

    # Q9 - synthesis (evaluated last)
    writers.write_permitted(ldam.q9_feasibility_decision_table(snap), "q9_feasibility_decision_table.csv")

    # Purge granular intermediates, then seal the manifest.
    removed = writers.purge_restricted()
    print(f"purged {len(removed)} restricted intermediate(s)")
    dest = ldam.write_ldam(cfg)
    print(f"LDAM written: {dest}")


if __name__ == "__main__":
    # Snapshot is intentionally unpinned in the scaffold; pin before a real run.
    run(SnapshotConfig())
