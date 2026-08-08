"""Deterministic Stage-2 compaction by publication_year (fixture / small scale)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

from .deterministic_writer import write_deterministic_parquet
from .duplicate_guard import assert_unique_work_ids
from .errors import FatalAcquisitionError
from .shard_manifest import shard_record
from .slim_schema import COLUMN_ORDER, schema_hash


def compact_stage1_to_year_shards(
    stage1_paths: list[Path],
    stage2_root: Path,
    *,
    source_object_indices: list[int] | None = None,
) -> tuple[list[dict[str, Any]], pa.Table]:
    """Read Stage-1 shards in given order, merge, dedupe-check, write per year.

    Returns (shard_records, combined_table).
    """
    if not stage1_paths:
        raise FatalAcquisitionError("no Stage-1 paths to compact")

    tables: list[pa.Table] = []
    for p in stage1_paths:
        tables.append(pq.read_table(p).select(list(COLUMN_ORDER)))
    combined = pa.concat_tables(tables, promote_options="default")
    # Global uniqueness across Stage-1 inputs
    assert_unique_work_ids(combined, context="stage2_compact")

    # Sort globally by work_id for stable year splits
    work_ids = combined.column("work_id").to_pylist()
    order = sorted(range(len(work_ids)), key=lambda i: work_ids[i] or "")
    combined = combined.take(pa.array(order, type=pa.int64()))

    years = sorted({int(y) for y in combined.column("publication_year").to_pylist() if y is not None})
    records: list[dict[str, Any]] = []
    stage2_root = Path(stage2_root)
    idxs = list(source_object_indices or [])

    for year in years:
        mask = [
            i
            for i, y in enumerate(combined.column("publication_year").to_pylist())
            if int(y) == year
        ]
        part = combined.take(pa.array(mask, type=pa.int64()))
        # Within-year order by work_id (already global-sorted; keep stable)
        dest = stage2_root / f"publication_year={year}" / "part-00000.parquet"
        meta = write_deterministic_parquet(part, dest)
        records.append(
            shard_record(
                logical_id=f"stage2/publication_year={year}/part-00000",
                stage=2,
                source_object_indices=idxs,
                publication_year=year,
                rows=int(meta["rows"]),
                bytes_=int(meta["bytes"]),
                sha256=str(meta["sha256"]),
                schema_sha256=str(meta["schema_sha256"]),
                min_publication_year=year,
                max_publication_year=year,
            )
        )
    return records, combined


def schema_sha256_locked() -> str:
    return schema_hash()
