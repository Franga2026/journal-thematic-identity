"""Stage-1 executor for a single object (fixture / authorized pilot object only).

This module refuses to iterate all 2446 objects. Production full-scan entrypoints
require FULL_SCAN_AUTHORIZED=true AND an explicit allow_full_scan flag.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

from .checkpoint import (
    STATUS_DONE,
    STATUS_FAILED,
    STATUS_RUNNING,
    STATUS_VERIFIED,
    CheckpointStore,
)
from .constants import STAGE1_ROOT
from .deterministic_writer import write_deterministic_parquet
from .disk_guard import assert_disk_capacity
from .errors import FatalAcquisitionError, RetryableAcquisitionError
from .extractor import slim_from_works_table
from .retries import run_with_retries
from .shard_manifest import shard_record


def full_scan_authorized() -> bool:
    """Return True only when env FULL_SCAN_AUTHORIZED is the string 'true'."""
    return os.environ.get("FULL_SCAN_AUTHORIZED", "false").strip().lower() == "true"


def run_production_full_scan(*_args: Any, **_kwargs: Any) -> None:
    """Production entrypoint placeholder — always refuse until future authorization.

    Requires FULL_SCAN_AUTHORIZED=true *and* a future implemented loop. This build
    never starts the 2446-object scan.
    """
    env_on = full_scan_authorized()
    raise FatalAcquisitionError(
        "full WORKS scan REFUSED / STOP: auth gate CLOSED for production path "
        f"(FULL_SCAN_AUTHORIZED={env_on}). "
        "Explicit user authorization and an implemented production loop are required."
    )


def stage1_shard_path(object_index: int, root: Path | None = None) -> Path:
    base = Path(root) if root else STAGE1_ROOT
    return base / f"object_index={object_index:04d}" / "part.parquet"


def process_local_works_object(
    *,
    object_index: int,
    local_parquet: Path,
    checkpoint: CheckpointStore | None = None,
    stage1_root: Path | None = None,
    minimum_free_space_bytes: int = 64 * 1024 * 1024,
    input_meta: dict[str, Any] | None = None,
    allow_full_scan: bool = False,
) -> dict[str, Any]:
    """Extract one local WORKS parquet object into a Stage-1 slim shard.

    Single-object / Level-2 / fixture use: leave allow_full_scan=False.
    """
    if allow_full_scan:
        raise FatalAcquisitionError(
            "full WORKS scan REFUSED: allow_full_scan is not permitted; "
            "use run_production_full_scan only after explicit authorization."
        )

    local_parquet = Path(local_parquet)
    if not local_parquet.is_file():
        raise FatalAcquisitionError(f"local parquet missing: {local_parquet}")

    store = checkpoint or CheckpointStore()
    if store.should_skip(object_index):
        entry = store.get(object_index) or {}
        return {"skipped": True, "object_index": object_index, "entry": entry}

    dest = stage1_shard_path(object_index, stage1_root)
    assert_disk_capacity(
        dest.parent,
        estimated_write_bytes=local_parquet.stat().st_size,
        minimum_free_space_bytes=minimum_free_space_bytes,
        safety_margin_bytes=16 * 1024 * 1024,
    )

    meta = dict(input_meta or {})
    store.set_status(
        object_index,
        STATUS_RUNNING,
        input_key=meta.get("s3_key") or str(local_parquet),
        input_size=int(meta.get("content_length") or local_parquet.stat().st_size),
        input_checksum_metadata=meta.get("checksum_metadata"),
        attempts=int((store.get(object_index) or {}).get("attempts") or 0) + 1,
    )

    _SLIM_READ_COLUMNS = (
        "id",
        "publication_year",
        "primary_location",
        "primary_topic",
        "topics",
        "type",
        "language",
        "cited_by_count",
        "referenced_works_count",
        "abstract_inverted_index",
        "counts_by_year",
    )

    def _once() -> dict[str, Any]:
        try:
            # Column projection — avoid loading authorships/locations blobs into RAM.
            pf = pq.ParquetFile(local_parquet)
            available = set(pf.schema_arrow.names)
            cols = [c for c in _SLIM_READ_COLUMNS if c in available]
            table = pf.read(columns=cols)
        except OSError as exc:
            raise RetryableAcquisitionError(f"read failed: {exc}") from exc
        slim, stats = slim_from_works_table(table)
        written = write_deterministic_parquet(slim, dest)
        years = slim.column("publication_year").to_pylist()
        ymin = min(years) if years else None
        ymax = max(years) if years else None
        rec = shard_record(
            logical_id=f"stage1/object_index={object_index:04d}/part",
            stage=1,
            source_object_indices=[object_index],
            publication_year=None,
            rows=int(written["rows"]),
            bytes_=int(written["bytes"]),
            sha256=str(written["sha256"]),
            schema_sha256=str(written["schema_sha256"]),
            min_publication_year=ymin,
            max_publication_year=ymax,
        )
        return {"stats": stats, "shard": rec, "written": written}

    try:
        result = run_with_retries(_once, object_index=object_index, sleep=lambda _t: None)
    except Exception as exc:  # noqa: BLE001
        store.set_status(
            object_index,
            STATUS_FAILED,
            error_class=type(exc).__name__,
            error_message=str(exc)[:500],
        )
        raise

    store.set_status(
        object_index,
        STATUS_DONE,
        rows_in=result["stats"]["input_rows"],
        rows_retained=result["stats"]["output_rows"],
        output_shards=[
            {
                "path": result["written"]["path"],
                "sha256": result["written"]["sha256"],
                "schema_sha256": result["written"]["schema_sha256"],
                "bytes": result["written"]["bytes"],
            }
        ],
        output_sha256=result["written"]["sha256"],
        error_class=None,
    )
    # Verify path for VERIFIED transition
    if store.should_skip(object_index):
        store.set_status(object_index, STATUS_VERIFIED)
    return {"skipped": False, "object_index": object_index, **result}
