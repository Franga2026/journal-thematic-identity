"""Pytest path bootstrap for Paper 3 acquisition tests."""

from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
FEAS = REPO / "feasibility"
FIX = Path(__file__).resolve().parent / "fixtures"
for p in (FEAS, FIX, REPO):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))
