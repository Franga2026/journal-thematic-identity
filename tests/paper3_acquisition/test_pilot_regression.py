from __future__ import annotations

import hashlib
from pathlib import Path

from src.acquisition.constants import PILOT_SLIM_SHA256, REPO_ROOT


def test_pilot_slim_sha_unchanged():
    path = REPO_ROOT / "data" / "paper3" / "bootstrap" / "works_slim_pilot.parquet"
    assert path.is_file(), "pilot slim parquet missing"
    h = hashlib.sha256(path.read_bytes()).hexdigest()
    assert h == PILOT_SLIM_SHA256
