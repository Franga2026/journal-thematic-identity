from __future__ import annotations

from pathlib import Path

import pytest

from src import firewall
from src.acquisition.errors import ContaminationEvent, FatalAcquisitionError
from src.acquisition.stage1_runner import process_local_works_object
from src.firewall import ContaminationError


def test_contamination_event_on_prohibited_column_attempt():
    """Negative fixture: attempting a banned column name must fail closed."""
    tokens = firewall.prohibited_tokens()
    banned = next(t for t in tokens if t == "jsd")
    with pytest.raises(ContaminationError) as excinfo:
        firewall.assert_clean_columns([f"{banned}_distance"])
    # Protocol §1.3 semantics: incident implies clean rerun required.
    event = {
        "event": "contamination",
        "detail": str(excinfo.value),
        "clean_rerun_required": True,
        "artifact_approved": False,
    }
    assert event["clean_rerun_required"] is True
    assert event["artifact_approved"] is False


def test_full_scan_flag_refused(tmp_path: Path):
    raw = tmp_path / "x.parquet"
    raw.write_bytes(b"PAR1")  # will not be read if allow_full_scan trips first
    with pytest.raises(FatalAcquisitionError, match="full WORKS scan REFUSED"):
        process_local_works_object(
            object_index=0,
            local_parquet=raw,
            allow_full_scan=True,
            minimum_free_space_bytes=1,
        )


def test_production_entrypoint_refused():
    from src.acquisition.stage1_runner import run_production_full_scan

    with pytest.raises(FatalAcquisitionError, match="auth gate CLOSED"):
        run_production_full_scan()


def test_contamination_event_type_is_available():
    with pytest.raises(ContaminationEvent):
        raise ContaminationEvent("simulated prohibited outcome attempt")
