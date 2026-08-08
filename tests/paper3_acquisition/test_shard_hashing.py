from __future__ import annotations

from pathlib import Path

import pyarrow.parquet as pq

from make_synthetic_works import make_works_table
from src.acquisition.extractor import slim_from_works_table
from src.acquisition.shard_manifest import (
    shard_record,
    shards_manifest_sha256,
    write_shards_manifest,
)
from src.acquisition.stage1_runner import process_local_works_object
from src.acquisition.stage2_compact import compact_stage1_to_year_shards
from src.acquisition.checkpoint import CheckpointStore


def test_shard_hash_reproducible_and_manifest_root(tmp_path: Path):
    raw = tmp_path / "raw.parquet"
    pq.write_table(
        make_works_table(
            [
                {"id": "https://openalex.org/W1", "publication_year": 2001},
                {"id": "https://openalex.org/W2", "publication_year": 2002},
            ]
        ),
        raw,
    )
    ck = CheckpointStore(tmp_path / "ckpt.json")
    stage1 = tmp_path / "stage1"
    r = process_local_works_object(
        object_index=0,
        local_parquet=raw,
        checkpoint=ck,
        stage1_root=stage1,
        minimum_free_space_bytes=1,
    )
    # Level-2 style: re-extract to a different root and compare bytes hash
    ck2 = CheckpointStore(tmp_path / "ckpt2.json")
    stage1b = tmp_path / "stage1b"
    r2 = process_local_works_object(
        object_index=0,
        local_parquet=raw,
        checkpoint=ck2,
        stage1_root=stage1b,
        minimum_free_space_bytes=1,
    )
    assert r["written"]["sha256"] == r2["written"]["sha256"]

    manifest = {
        "manifest_version": "1.0",
        "shards": [r["shard"], {"timestamp": "SHOULD_BE_STRIPPED", **r["shard"]}],
    }
    # duplicate logical ids after strip — use single shard
    manifest = {"manifest_version": "1.0", "shards": [r["shard"]]}
    h1 = shards_manifest_sha256(manifest)
    path, root = write_shards_manifest(manifest, dest=tmp_path / "layer_b_shards_manifest.json")
    assert path.is_file()
    assert root == h1

    # Stage-2 on fixture
    recs, _ = compact_stage1_to_year_shards(
        [stage1 / "object_index=0000" / "part.parquet"],
        tmp_path / "stage2",
        source_object_indices=[0],
    )
    assert len(recs) == 2
    assert all(x["stage"] == 2 for x in recs)


def test_level2_indexes_are_predefined_not_content_chosen():
    from src.acquisition.constants import LEVEL2_OBJECT_INDEXES

    assert LEVEL2_OBJECT_INDEXES[0] == 0
    assert 1223 in LEVEL2_OBJECT_INDEXES
    assert LEVEL2_OBJECT_INDEXES[-1] == 2445
