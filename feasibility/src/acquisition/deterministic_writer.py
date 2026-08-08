"""Sanctioned deterministic parquet writer for Layer B shards.

This is the only acquisition module allowed to call ``pq.write_table``.
CI (``check_acquisition_no_raw_writes.py``) enforces that boundary.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

from .. import firewall
from .errors import SchemaMismatchError
from .slim_schema import SLIM_SCHEMA, assert_slim_schema, schema_hash

# Locked writer options (acquisition spec §11).
COMPRESSION = "zstd"
COMPRESSION_LEVEL = 3
USE_DICTIONARY = False
WRITE_STATISTICS = False
DATA_PAGE_VERSION = "1.0"
ROW_GROUP_SIZE = 1_048_576


def write_deterministic_parquet(table: pa.Table, dest: Path) -> dict[str, object]:
    """Write *table* with locked options; return path/bytes/sha256/schema_hash."""
    firewall.assert_clean_columns(table.column_names)
    # Cast to exact locked schema (nullability / nested types).
    try:
        casted = table.cast(SLIM_SCHEMA, safe=False)
    except Exception as exc:  # noqa: BLE001 — surface as schema failure
        raise SchemaMismatchError(f"cannot cast to slim schema: {exc}") from exc
    assert_slim_schema(casted)

    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(
        casted,
        dest,
        compression=COMPRESSION,
        compression_level=COMPRESSION_LEVEL,
        use_dictionary=USE_DICTIONARY,
        write_statistics=WRITE_STATISTICS,
        store_schema=True,
        data_page_version=DATA_PAGE_VERSION,
        row_group_size=ROW_GROUP_SIZE,
    )
    data = dest.read_bytes()
    return {
        "path": str(dest),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "schema_sha256": schema_hash(casted.schema),
        "rows": casted.num_rows,
    }
