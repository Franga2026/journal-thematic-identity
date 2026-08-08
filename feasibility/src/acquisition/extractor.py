"""Slim projection from OpenAlex WORKS parquet tables (single-object scope)."""

from __future__ import annotations

from typing import Any

import pyarrow as pa
import pyarrow.compute as pc

from .constants import YEAR_MAX, YEAR_MIN
from .duplicate_guard import assert_unique_work_ids
from .errors import FatalAcquisitionError
from .slim_schema import COLUMN_ORDER, SLIM_SCHEMA


def _source_id_from_primary_location(col: pa.ChunkedArray | pa.Array) -> list[str | None]:
    out: list[str | None] = []
    for i in range(len(col)):
        if not col[i].is_valid:
            out.append(None)
            continue
        val = col[i].as_py()
        if not isinstance(val, dict):
            out.append(None)
            continue
        src = val.get("source")
        if isinstance(src, dict):
            sid = src.get("id")
            out.append(str(sid) if sid else None)
        else:
            out.append(None)
    return out


def _topic_fields(
    primary_topic: pa.ChunkedArray | pa.Array,
    topics: pa.ChunkedArray | pa.Array,
) -> tuple[list[bool], list[bool], list[str | None], list[str | None], list[list[dict[str, Any]]]]:
    has_topic: list[bool] = []
    has_subfield: list[bool] = []
    primary_ids: list[str | None] = []
    primary_subfields: list[str | None] = []
    assignments: list[list[dict[str, Any]]] = []

    for i in range(len(primary_topic)):
        pt = primary_topic[i].as_py() if primary_topic[i].is_valid else None
        tl = topics[i].as_py() if topics[i].is_valid else None

        pid: str | None = None
        psf: str | None = None
        ht = False
        if isinstance(pt, dict) and pt.get("id"):
            ht = True
            pid = str(pt["id"])
            sf = pt.get("subfield")
            if isinstance(sf, dict) and sf.get("id"):
                psf = str(sf["id"])

        assign_map: dict[str, float] = {}
        if isinstance(tl, list):
            for item in tl:
                if not isinstance(item, dict) or not item.get("id"):
                    continue
                tid = str(item["id"])
                score = item.get("score")
                try:
                    sc = float(score) if score is not None else 0.0
                except (TypeError, ValueError):
                    sc = 0.0
                # Deterministic: keep max score if id repeats inside list
                prev = assign_map.get(tid)
                if prev is None or sc > prev:
                    assign_map[tid] = sc
                sf = item.get("subfield")
                if psf is None and isinstance(sf, dict) and sf.get("id"):
                    psf = str(sf["id"])

        assign_list = [
            {"topic_id": tid, "score": float(assign_map[tid])}
            for tid in sorted(assign_map.keys())
        ]
        hs = bool(psf) or bool(assign_list) or ht
        has_topic.append(ht or bool(assign_list))
        has_subfield.append(hs)
        primary_ids.append(pid)
        primary_subfields.append(psf)
        assignments.append(assign_list)

    return has_topic, has_subfield, primary_ids, primary_subfields, assignments


def _has_abstract(col: pa.ChunkedArray | pa.Array) -> list[bool]:
    out: list[bool] = []
    for i in range(len(col)):
        if not col[i].is_valid:
            out.append(False)
            continue
        v = col[i].as_py()
        if v is None:
            out.append(False)
        elif isinstance(v, str):
            out.append(v.strip() not in ("", "{}", "null"))
        elif isinstance(v, dict):
            out.append(len(v) > 0)
        else:
            out.append(bool(v))
    return out


def _counts_by_year(col: pa.ChunkedArray | pa.Array) -> list[list[dict[str, int]]]:
    out: list[list[dict[str, int]]] = []
    for i in range(len(col)):
        if not col[i].is_valid:
            out.append([])
            continue
        raw = col[i].as_py()
        if not isinstance(raw, list):
            out.append([])
            continue
        items: list[dict[str, int]] = []
        for el in raw:
            if not isinstance(el, dict):
                continue
            year = el.get("year")
            cites = el.get("cited_by_count")
            if year is None:
                continue
            items.append(
                {
                    "year": int(year),
                    "cited_by_count": int(cites) if cites is not None else 0,
                }
            )
        items.sort(key=lambda d: d["year"])
        out.append(items)
    return out


def slim_from_works_table(table: pa.Table) -> tuple[pa.Table, dict[str, Any]]:
    """Filter years and project Class A + Class B columns; sort by work_id."""
    required = {
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
    }
    missing = sorted(required - set(table.column_names))
    if missing:
        raise FatalAcquisitionError(f"WORKS table missing required columns: {missing}")

    years = table.column("publication_year")
    mask = pc.and_(
        pc.greater_equal(years, YEAR_MIN),
        pc.less_equal(years, YEAR_MAX),
    )
    filtered = table.filter(mask)
    n_in = table.num_rows
    n_keep = filtered.num_rows

    source_ids = _source_id_from_primary_location(filtered.column("primary_location"))
    has_source = [s is not None and str(s).strip() != "" for s in source_ids]
    has_topic, has_subfield, primary_ids, primary_subfields, assignments = _topic_fields(
        filtered.column("primary_topic"),
        filtered.column("topics"),
    )
    has_abstract = _has_abstract(filtered.column("abstract_inverted_index"))
    ref_count = filtered.column("referenced_works_count").to_pylist()
    ref_count_i = [int(x) if x is not None else 0 for x in ref_count]
    has_references = [c > 0 for c in ref_count_i]
    work_ids = [str(x) if x is not None else "" for x in filtered.column("id").to_pylist()]
    pub_years = filtered.column("publication_year").to_pylist()
    types = filtered.column("type").to_pylist()
    langs = filtered.column("language").to_pylist()
    cited = filtered.column("cited_by_count").to_pylist()
    cited_i = [int(x) if x is not None else 0 for x in cited]
    cby = _counts_by_year(filtered.column("counts_by_year"))

    order = sorted(range(len(work_ids)), key=lambda i: work_ids[i] or "")

    def take(seq: list[Any]) -> list[Any]:
        return [seq[i] for i in order]

    slim = pa.table(
        {
            "work_id": pa.array(take(work_ids), type=pa.string()),
            "publication_year": pa.array(take(pub_years), type=pa.int32()),
            "source_id": pa.array(take(source_ids), type=pa.string()),
            "work_type": pa.array(
                [None if x is None else str(x) for x in take(types)], type=pa.string()
            ),
            "language": pa.array(
                [None if x is None else str(x) for x in take(langs)], type=pa.string()
            ),
            "cited_by_count": pa.array(take(cited_i), type=pa.int32()),
            "referenced_works_count": pa.array(take(ref_count_i), type=pa.int32()),
            "has_source": pa.array(take(has_source), type=pa.bool_()),
            "has_abstract": pa.array(take(has_abstract), type=pa.bool_()),
            "has_references": pa.array(take(has_references), type=pa.bool_()),
            "has_topic": pa.array(take(has_topic), type=pa.bool_()),
            "has_subfield": pa.array(take(has_subfield), type=pa.bool_()),
            "primary_topic_id": pa.array(take(primary_ids), type=pa.string()),
            "primary_subfield_id": pa.array(take(primary_subfields), type=pa.string()),
            "topic_assignments": pa.array(take(assignments), type=SLIM_SCHEMA.field("topic_assignments").type),
            "counts_by_year": pa.array(take(cby), type=SLIM_SCHEMA.field("counts_by_year").type),
        }
    )
    # Enforce column order
    slim = slim.select(list(COLUMN_ORDER))
    assert_unique_work_ids(slim, context="stage1_pre_write")
    stats = {
        "input_rows": n_in,
        "rows_year_horizon": n_keep,
        "output_rows": slim.num_rows,
        "columns": list(slim.column_names),
    }
    return slim, stats
