"""Locked Layer B slim schema (Class A availability + Class B raw inputs).

Class C (forbidden derived fields) must never appear as columns. Enumeration of
banned outcome tokens lives in ``ci/prohibited_symbols.txt`` and is enforced by
``firewall.assert_clean_columns`` — this module does not restate those tokens
as non-docstring literals.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

import pyarrow as pa

from .constants import YEAR_MAX, YEAR_MIN
from .errors import SchemaMismatchError

# --- Class A: Phase-0 availability ---
CLASS_A_FIELDS: tuple[str, ...] = (
    "work_id",
    "publication_year",
    "source_id",
    "work_type",
    "language",
    "cited_by_count",
    "referenced_works_count",
    "has_source",
    "has_abstract",
    "has_references",
    "has_topic",
    "has_subfield",
)

# --- Class B: raw inputs for later Pipeline B / Phase-0 constructibility ---
# Representation choice for topic assignments:
#   list<struct<topic_id:string, score:float32>>
# Pros: compact; deterministic after sort by topic_id; no journal aggregation;
#       sufficient to rebuild work-level topic inputs post-preregistration.
# Cons: wider than flags alone; still requires frozen taxonomy for names.
CLASS_B_FIELDS: tuple[str, ...] = (
    "primary_topic_id",
    "primary_subfield_id",
    "topic_assignments",
    "counts_by_year",
)

COLUMN_ORDER: tuple[str, ...] = CLASS_A_FIELDS + CLASS_B_FIELDS

TOPIC_ASSIGNMENT_TYPE = pa.list_(
    pa.struct(
        [
            ("topic_id", pa.string()),
            ("score", pa.float32()),
        ]
    )
)
COUNTS_BY_YEAR_TYPE = pa.list_(
    pa.struct(
        [
            ("year", pa.int16()),
            ("cited_by_count", pa.int32()),
        ]
    )
)

SLIM_SCHEMA = pa.schema(
    [
        ("work_id", pa.string()),
        ("publication_year", pa.int32()),
        ("source_id", pa.string()),
        ("work_type", pa.string()),
        ("language", pa.string()),
        ("cited_by_count", pa.int32()),
        ("referenced_works_count", pa.int32()),
        ("has_source", pa.bool_()),
        ("has_abstract", pa.bool_()),
        ("has_references", pa.bool_()),
        ("has_topic", pa.bool_()),
        ("has_subfield", pa.bool_()),
        ("primary_topic_id", pa.string()),
        ("primary_subfield_id", pa.string()),
        ("topic_assignments", TOPIC_ASSIGNMENT_TYPE),
        ("counts_by_year", COUNTS_BY_YEAR_TYPE),
    ]
)


def schema_hash(schema: pa.Schema = SLIM_SCHEMA) -> str:
    """SHA-256 of a canonical schema description (no volatile metadata)."""
    fields: list[dict[str, Any]] = []
    for f in schema:
        fields.append(
            {
                "name": f.name,
                "nullable": f.nullable,
                "type": str(f.type),
            }
        )
    payload = {"fields": fields}
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


SCHEMA_HASH = schema_hash(SLIM_SCHEMA)


def assert_slim_schema(table: pa.Table) -> None:
    """Reject tables whose column names/order/types do not match SLIM_SCHEMA."""
    if table.column_names != list(COLUMN_ORDER):
        raise SchemaMismatchError(
            f"column order mismatch: {table.column_names} != {list(COLUMN_ORDER)}"
        )
    # Compare types via string form for nested stability across pyarrow builds
    for name in COLUMN_ORDER:
        got = str(table.schema.field(name).type)
        exp = str(SLIM_SCHEMA.field(name).type)
        if got != exp:
            raise SchemaMismatchError(f"type mismatch on {name}: {got} != {exp}")


def year_filter_bounds() -> tuple[int, int]:
    return YEAR_MIN, YEAR_MAX
