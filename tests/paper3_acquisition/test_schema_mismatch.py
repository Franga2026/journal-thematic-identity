from __future__ import annotations

from pathlib import Path

import pyarrow as pa
import pytest

from src.acquisition.deterministic_writer import write_deterministic_parquet
from src.acquisition.errors import SchemaMismatchError
from src.acquisition.slim_schema import SCHEMA_HASH, schema_hash


def test_schema_hash_stable():
    assert schema_hash() == SCHEMA_HASH
    assert len(SCHEMA_HASH) == 64


def test_schema_mismatch_rejected(tmp_path: Path):
    bad = pa.table({"work_id": pa.array(["W1"], type=pa.string())})
    with pytest.raises(SchemaMismatchError):
        write_deterministic_parquet(bad, tmp_path / "bad.parquet")
