from __future__ import annotations

from pathlib import Path

from src.acquisition.final_manifest import (
    pending_full_acquisition_manifest,
    validate_manifest_shape,
    write_pending_manifest,
)


def test_pending_manifest_template(tmp_path: Path):
    m = pending_full_acquisition_manifest()
    validate_manifest_shape(m)
    assert m["completed_objects"] == 0
    assert m["failed_objects"] == 0
    assert m["run_started_at"] is None
    assert m["extractor_git_commit"] is None
    assert m["full_works_scan_started"] is False
    assert m["prohibited_outcomes_computed"] is False
    assert m["FULL_SCAN_AUTHORIZED"] is False
    path = write_pending_manifest(dest=tmp_path / "paper3_full_acquisition_manifest.json")
    assert path.is_file()
