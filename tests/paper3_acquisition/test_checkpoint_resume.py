from __future__ import annotations

from pathlib import Path

import pytest

from make_synthetic_works import make_works_table
from src.acquisition.checkpoint import CheckpointStore, STATUS_DONE
from src.acquisition.errors import CheckpointIntegrityError
from src.acquisition.stage1_runner import process_local_works_object
import pyarrow.parquet as pq


def _write_raw(tmp_path: Path, name: str = "raw.parquet") -> Path:
    table = make_works_table(
        [
            {"id": "https://openalex.org/W1", "publication_year": 2012, "source_id": "S1"},
            {"id": "https://openalex.org/W2", "publication_year": 2013, "source_id": "S1"},
        ]
    )
    path = tmp_path / name
    pq.write_table(table, path)
    return path


def test_checkpoint_resume_with_valid_hash(tmp_path: Path):
    raw = _write_raw(tmp_path)
    ck = CheckpointStore(tmp_path / "ckpt.json")
    stage1 = tmp_path / "stage1"
    r1 = process_local_works_object(
        object_index=0,
        local_parquet=raw,
        checkpoint=ck,
        stage1_root=stage1,
        minimum_free_space_bytes=1,
    )
    assert r1["skipped"] is False
    r2 = process_local_works_object(
        object_index=0,
        local_parquet=raw,
        checkpoint=ck,
        stage1_root=stage1,
        minimum_free_space_bytes=1,
    )
    assert r2["skipped"] is True
    assert ck.get(0)["status"] in {STATUS_DONE, "VERIFIED"}


def test_checkpoint_done_but_shard_missing(tmp_path: Path):
    raw = _write_raw(tmp_path)
    ck = CheckpointStore(tmp_path / "ckpt.json")
    stage1 = tmp_path / "stage1"
    process_local_works_object(
        object_index=1,
        local_parquet=raw,
        checkpoint=ck,
        stage1_root=stage1,
        minimum_free_space_bytes=1,
    )
    # Delete shard
    shard = stage1 / "object_index=0001" / "part.parquet"
    shard.unlink()
    with pytest.raises(CheckpointIntegrityError, match="shard missing"):
        process_local_works_object(
            object_index=1,
            local_parquet=raw,
            checkpoint=ck,
            stage1_root=stage1,
            minimum_free_space_bytes=1,
        )


def test_checkpoint_done_but_hash_mismatches(tmp_path: Path):
    raw = _write_raw(tmp_path)
    ck = CheckpointStore(tmp_path / "ckpt.json")
    stage1 = tmp_path / "stage1"
    process_local_works_object(
        object_index=2,
        local_parquet=raw,
        checkpoint=ck,
        stage1_root=stage1,
        minimum_free_space_bytes=1,
    )
    shard = stage1 / "object_index=0002" / "part.parquet"
    shard.write_bytes(shard.read_bytes() + b"x")
    with pytest.raises(CheckpointIntegrityError, match="hash mismatch"):
        process_local_works_object(
            object_index=2,
            local_parquet=raw,
            checkpoint=ck,
            stage1_root=stage1,
            minimum_free_space_bytes=1,
        )
