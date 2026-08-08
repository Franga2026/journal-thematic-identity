from __future__ import annotations

import runpy
import sys
from pathlib import Path

import pytest


def test_raw_writer_bypass_detected(tmp_path: Path, monkeypatch):
    """A module under src/ with unsanctioned to_parquet must fail the CI gate."""
    feas = Path(__file__).resolve().parents[2] / "feasibility"
    rogue = feas / "src" / "_rogue_write_probe.py"
    rogue.write_text("def f(df, p):\n    df.to_parquet(p)\n", encoding="utf-8")
    try:
        script = feas / "ci" / "check_acquisition_no_raw_writes.py"
        # Execute check as __main__
        ns = {"__name__": "__not_main__"}
        # Import main directly
        sys.path.insert(0, str(feas / "ci"))
        import importlib.util

        spec = importlib.util.spec_from_file_location("no_raw", script)
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        rc = mod.main()
        assert rc == 1
    finally:
        if rogue.exists():
            rogue.unlink()
