"""One-partition OpenAlex WORKS acquisition pilot (SliceSpec v0.2).

Outcome-blind: filters by publication year and emits availability flags/counts
only. Does not scan the full WORKS corpus. Does not read cris_victoria.works.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import resource
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import boto3
import pandas as pd
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq
from botocore import UNSIGNED
from botocore.config import Config

from . import writers
from .config import PROTOCOL_SHA256, SnapshotConfig
from .coverage import q1_coverage_by_year
from .io_snapshot import load_snapshot

REPO = Path(__file__).resolve().parents[2]
BOOTSTRAP = REPO / "data" / "paper3" / "bootstrap"
MANIFEST_NAME = "works_manifest.pinned.json"
RAW_NAME = "selected_object.raw.parquet"
SLIM_NAME = "works_slim_pilot.parquet"

SELECTION_RULE = (
    "lexicographic_sort_of_manifest_file_urls; first readable parquet object"
)
YEAR_MIN = 2000
YEAR_MAX = 2026


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _s3_client():
    return boto3.client("s3", config=Config(signature_version=UNSIGNED))


def pin_works_manifest(force: bool = False) -> tuple[Path, dict[str, Any], str]:
    """Download/pin WORKS manifest; return path, parsed JSON, sha256."""
    BOOTSTRAP.mkdir(parents=True, exist_ok=True)
    dest = BOOTSTRAP / MANIFEST_NAME
    if force or not dest.exists():
        client = _s3_client()
        obj = client.get_object(Bucket="openalex", Key="data/parquet/works/manifest.json")
        body = obj["Body"].read()
        writers.write_bootstrap_bytes(MANIFEST_NAME, body)
    raw = dest.read_bytes()
    return dest, json.loads(raw.decode("utf-8")), _sha256_bytes(raw)


def select_object(manifest: dict[str, Any]) -> dict[str, Any]:
    """Deterministic selection: sorted URLs, first entry."""
    files = list(manifest.get("files") or [])
    if not files:
        raise RuntimeError("WORKS manifest contains no files")
    ordered = sorted(files, key=lambda f: f["url"])
    for idx, item in enumerate(ordered):
        url = item["url"]
        if url.endswith(".parquet"):
            return {
                "selection_rule": SELECTION_RULE,
                "selection_index": idx,
                "selected_object_key": url,
                "selected_object_size": int((item.get("meta") or {}).get("content_length") or 0),
                "selected_record_count_meta": int(
                    (item.get("meta") or {}).get("record_count") or 0
                ),
            }
    raise RuntimeError("No parquet object found in WORKS manifest")


def _parse_s3_url(url: str) -> tuple[str, str]:
    # s3://openalex/data/parquet/works/...
    if not url.startswith("s3://"):
        raise ValueError(url)
    rest = url[len("s3://") :]
    bucket, _, key = rest.partition("/")
    return bucket, key


def fetch_selected_object(selection: dict[str, Any]) -> tuple[Path, str, dict[str, Any]]:
    """Download selected object to bootstrap; return path, sha256, s3 metadata."""
    bucket, key = _parse_s3_url(selection["selected_object_key"])
    client = _s3_client()
    obj = client.get_object(Bucket=bucket, Key=key)
    body = obj["Body"].read()
    etag = (obj.get("ETag") or "").strip('"')
    meta = {
        "s3_etag": etag,
        "s3_etag_is_not_sha256": True,
        "s3_content_length": int(obj.get("ContentLength") or len(body)),
        "content_type": obj.get("ContentType"),
        "last_modified": obj["LastModified"].strftime("%Y-%m-%dT%H:%M:%SZ")
        if obj.get("LastModified")
        else None,
    }
    path = writers.write_bootstrap_bytes(RAW_NAME, body)
    return path, _sha256_bytes(body), meta


def _source_id_from_primary_location(col: pa.Array) -> list[str | None]:
    out: list[str | None] = []
    for i in range(len(col)):
        if not col[i].is_valid:
            out.append(None)
            continue
        # struct -> source -> id
        try:
            src = col[i].as_py()
        except Exception:
            out.append(None)
            continue
        if not isinstance(src, dict):
            out.append(None)
            continue
        source = src.get("source") or {}
        sid = source.get("id") if isinstance(source, dict) else None
        out.append(sid)
    return out


def _has_nested(col: pa.Array) -> list[bool]:
    flags: list[bool] = []
    for i in range(len(col)):
        if not col[i].is_valid:
            flags.append(False)
            continue
        val = col[i].as_py()
        if val is None:
            flags.append(False)
        elif isinstance(val, (list, dict, str)):
            flags.append(len(val) > 0)
        else:
            flags.append(True)
    return flags


def slim_table(table: pa.Table) -> tuple[pa.Table, dict[str, Any]]:
    """Filter years and project availability columns only."""
    schema_names = list(table.column_names)
    years = table.column("publication_year")
    mask = pc.and_(pc.greater_equal(years, YEAR_MIN), pc.less_equal(years, YEAR_MAX))
    filtered = table.filter(mask)
    n_in = table.num_rows
    n_keep = filtered.num_rows

    pl = filtered.column("primary_location")
    source_ids = _source_id_from_primary_location(pl)
    has_source = [s is not None and str(s).strip() != "" for s in source_ids]

    has_topic = _has_nested(filtered.column("primary_topic"))
    # also true if topics list non-empty
    topics_flags = _has_nested(filtered.column("topics"))
    has_subfield = [
        bool(ht or tf) for ht, tf in zip(has_topic, topics_flags, strict=True)
    ]

    abs_col = filtered.column("abstract_inverted_index")
    has_abstract = []
    for i in range(len(abs_col)):
        if not abs_col[i].is_valid:
            has_abstract.append(False)
        else:
            v = abs_col[i].as_py()
            has_abstract.append(bool(v) and str(v).strip() not in ("", "{}", "null"))

    ref_count = filtered.column("referenced_works_count").to_pylist()
    ref_count_i = [int(x) if x is not None else 0 for x in ref_count]
    has_references = [c > 0 for c in ref_count_i]

    work_ids = filtered.column("id").to_pylist()
    pub_years = filtered.column("publication_year").to_pylist()
    types = filtered.column("type").to_pylist()
    langs = filtered.column("language").to_pylist()
    cited = filtered.column("cited_by_count").to_pylist()
    cited_i = [int(x) if x is not None else 0 for x in cited]

    # Deterministic row order
    order = sorted(range(len(work_ids)), key=lambda i: (work_ids[i] or ""))

    def take(seq: list[Any]) -> list[Any]:
        return [seq[i] for i in order]

    slim = pa.table(
        {
            "work_id": pa.array(take(work_ids), type=pa.string()),
            "publication_year": pa.array(take(pub_years), type=pa.int32()),
            "source_id": pa.array(take(source_ids), type=pa.string()),
            "work_type": pa.array(take(types), type=pa.string()),
            "language": pa.array(take(langs), type=pa.string()),
            "cited_by_count": pa.array(take(cited_i), type=pa.int32()),
            "referenced_works_count": pa.array(take(ref_count_i), type=pa.int32()),
            "has_source": pa.array(take(has_source), type=pa.bool_()),
            "has_abstract": pa.array(take(has_abstract), type=pa.bool_()),
            "has_references": pa.array(take(has_references), type=pa.bool_()),
            "has_topic": pa.array(take(has_topic), type=pa.bool_()),
            "has_subfield": pa.array(take(has_subfield), type=pa.bool_()),
        }
    )
    stats = {
        "input_rows": n_in,
        "rows_year_horizon": n_keep,
        "output_rows": slim.num_rows,
        "source_schema_columns": schema_names,
        "slim_columns": slim.column_names,
    }
    return slim, stats


def extract_once(run_id: int) -> dict[str, Any]:
    """Run one acquisition+extract cycle; return technical metrics."""
    t0 = time.perf_counter()
    peak0 = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss

    man_path, manifest, man_sha = pin_works_manifest(force=False)
    selection = select_object(manifest)
    raw_path, raw_sha, s3_meta = fetch_selected_object(selection)

    table = pq.read_table(raw_path)
    slim, stats = slim_table(table)
    slim_path = writers.write_bootstrap_parquet(SLIM_NAME, slim)
    slim_sha = _sha256_file(slim_path)

    schema_payload = {
        "source_schema_columns": stats["source_schema_columns"],
        "slim_columns": stats["slim_columns"],
        "year_filter": {"min": YEAR_MIN, "max": YEAR_MAX},
    }
    writers.write_bootstrap_json("pilot_schema.json", schema_payload)

    input_manifest = {
        "PILOT_INFRASTRUCTURE_ONLY": True,
        "project": "paper3",
        "phase": "feasibility_pilot_v0.2",
        "source": "OpenAlex",
        "snapshot_date": manifest.get("date"),
        "release_notes_tag": "2026-06-25",
        "official_source": {
            "bucket": "s3://openalex",
            "format": "parquet",
            "entity": "works",
            "docs": [
                "https://developers.openalex.org/download/snapshot-format",
                "https://developers.openalex.org/download/download-to-machine",
            ],
        },
        "works_manifest_local": str(man_path.relative_to(REPO)),
        "works_manifest_sha256": man_sha,
        "works_manifest_record_count": manifest.get("record_count"),
        "works_manifest_content_length": manifest.get("content_length"),
        "selection": selection,
        "selected_object_local": str(raw_path.relative_to(REPO)),
        "selected_object_sha256": raw_sha,
        "selected_object_s3_metadata": s3_meta,
        "retrieved_at": _utc_now(),
        "authorizing_protocol_sha256": PROTOCOL_SHA256,
        "prohibited_outcomes_computed": False,
        "run_id": run_id,
    }
    writers.write_bootstrap_json("pilot_input_manifest.json", input_manifest)

    elapsed = time.perf_counter() - t0
    peak1 = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    # macOS ru_maxrss is bytes; Linux is kilobytes — record raw + platform
    return {
        "run_id": run_id,
        "wall_clock_seconds": round(elapsed, 3),
        "peak_rss_raw": peak1,
        "peak_rss_delta_raw": peak1 - peak0,
        "rss_platform": platform.system(),
        "input_bytes": raw_path.stat().st_size,
        "output_bytes": slim_path.stat().st_size,
        "input_sha256": raw_sha,
        "output_sha256": slim_sha,
        "manifest_sha256": man_sha,
        "selection": selection,
        "stats": stats,
        "snapshot_date": manifest.get("date"),
    }


def run_q1_on_bootstrap(slim_sha: str) -> dict[str, Any]:
    """Bind io_snapshot to bootstrap slim parquet and emit Q1 via sanctioned writer."""
    cfg = SnapshotConfig(
        snapshot_date="2026-06-26",
        taxonomy_version="openalex_topics_manifest_2026-06-26",
        subfield_vocabulary_sha256=slim_sha,  # pilot binding: pin to slim artifact
        source_name="OpenAlex",
        notes="PILOT_INFRASTRUCTURE_ONLY one-partition WORKS bootstrap",
        substrate="works_pilot",
        bootstrap_works_path=str((BOOTSTRAP / SLIM_NAME).relative_to(REPO)),
        bootstrap_works_sha256=slim_sha,
    )
    snap = load_snapshot(cfg)
    df = q1_coverage_by_year(snap)
    out = writers.write_permitted(df, "q1_coverage_by_year.csv")
    return {
        "q1_path": str(out.relative_to(REPO)),
        "q1_sha256": _sha256_file(out),
        "q1_rows": int(len(df)),
        "PILOT_INFRASTRUCTURE_ONLY": True,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Paper3 one-partition WORKS pilot")
    parser.add_argument("--run-id", type=int, default=1)
    parser.add_argument("--skip-q1", action="store_true")
    args = parser.parse_args(argv)

    metrics = extract_once(args.run_id)
    q1_info: dict[str, Any] = {}
    if not args.skip_q1:
        q1_info = run_q1_on_bootstrap(metrics["output_sha256"])
        removed = writers.purge_restricted()
        writers.assert_restricted_purged()
        q1_info["restricted_purged"] = removed

    # checksums file
    lines = [
        f"{metrics['manifest_sha256']}  {MANIFEST_NAME}",
        f"{metrics['input_sha256']}  {RAW_NAME}",
        f"{metrics['output_sha256']}  {SLIM_NAME}",
    ]
    if q1_info.get("q1_sha256"):
        lines.append(f"{q1_info['q1_sha256']}  ../feasibility/out/q1_coverage_by_year.csv")
    writers.write_bootstrap_text("pilot_checksums.sha256", "\n".join(lines) + "\n")

    report = {
        "PILOT_INFRASTRUCTURE_ONLY": True,
        "prohibited_outcomes_computed": False,
        "openalex_release": {
            "manifest_date": metrics["snapshot_date"],
            "release_notes_tag": "2026-06-25",
        },
        "manifest_sha256": metrics["manifest_sha256"],
        "selected_object_key": metrics["selection"]["selected_object_key"],
        "object_bytes": metrics["input_bytes"],
        "object_checksum_metadata": {
            "sha256_of_downloaded_bytes": metrics["input_sha256"],
        },
        "input_rows": metrics["stats"]["input_rows"],
        "rows_with_publication_year_2000_2026": metrics["stats"]["rows_year_horizon"],
        "output_rows": metrics["stats"]["output_rows"],
        "output_bytes": metrics["output_bytes"],
        "compression_reduction_ratio": round(
            metrics["input_bytes"] / max(metrics["output_bytes"], 1), 4
        ),
        "wall_clock_seconds": metrics["wall_clock_seconds"],
        "peak_memory": {
            "ru_maxrss_raw": metrics["peak_rss_raw"],
            "platform": metrics["rss_platform"],
            "note": "macOS bytes; Linux kilobytes",
        },
        "docker": {
            "image_tag": os.environ.get("PAPER3_ACQ_IMAGE_TAG"),
            "image_id": os.environ.get("PAPER3_ACQ_IMAGE_ID"),
            "image_digest": os.environ.get("PAPER3_ACQ_IMAGE_DIGEST"),
            "python_version": sys.version.split()[0],
            "pyarrow_version": pa.__version__,
            "boto3_version": boto3.__version__,
        },
        "extractor": {
            "module": "feasibility.src.bootstrap_pilot",
            "run_id": args.run_id,
        },
        "output_sha256": metrics["output_sha256"],
        "q1": q1_info,
        "selection_rule": SELECTION_RULE,
        "full_works_scan_started": False,
        "used_cris_victoria_works": False,
    }
    # Merge into acquisition report file (caller may enrich with run2 / firewall)
    report_path = BOOTSTRAP / "pilot_acquisition_report.json"
    if report_path.exists():
        prev = json.loads(report_path.read_text(encoding="utf-8"))
    else:
        prev = {}
    key = f"run_{args.run_id}"
    prev[key] = report
    prev["PILOT_INFRASTRUCTURE_ONLY"] = True
    prev["prohibited_outcomes_computed"] = False
    writers.write_bootstrap_json("pilot_acquisition_report.json", prev)

    print(json.dumps({"ok": True, "run_id": args.run_id, "slim_sha256": metrics["output_sha256"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
