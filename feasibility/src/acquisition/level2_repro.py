"""Level-2 byte reproducibility for predefined object_index values."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import boto3
from botocore import UNSIGNED
from botocore.config import Config

from .checkpoint import CheckpointStore
from .constants import LEVEL2_OBJECT_INDEXES, REPO_ROOT
from .object_inventory import load_pinned_object_inventory
from .sanctioned_io import write_bytes, write_json
from .stage1_runner import process_local_works_object

LEVEL2_REPORT = (
    REPO_ROOT / "data" / "paper3" / "bootstrap" / "level2_reproducibility_report.json"
)
LEVEL2_CACHE = REPO_ROOT / "data" / "paper3" / "bootstrap" / "level2_objects"


def level2_byte_budget(indexes: tuple[int, ...] = LEVEL2_OBJECT_INDEXES) -> dict[str, Any]:
    inv = load_pinned_object_inventory()
    items = []
    total = 0
    for i in indexes:
        o = inv["objects"][i]
        total += int(o["content_length"])
        items.append(
            {
                "object_index": i,
                "s3_key": o["s3_key"],
                "content_length": o["content_length"],
            }
        )
    return {
        "indexes": list(indexes),
        "n_objects": len(indexes),
        "total_bytes": total,
        "total_gib": round(total / 1024**3, 3),
        "objects": items,
    }


def _fetch_object(s3_key: str, dest: Path) -> dict[str, Any]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    client = boto3.client("s3", config=Config(signature_version=UNSIGNED))
    obj = client.get_object(Bucket="openalex", Key=s3_key)
    body = obj["Body"].read()
    write_bytes(dest, body)
    return {
        "local_bytes": len(body),
        "etag": obj.get("ETag"),
        "sha256_note": "compute separately if needed; ETag is not SHA-256",
    }


def run_level2_reproducibility(
    *,
    indexes: tuple[int, ...] | None = None,
    max_total_bytes: int = 3 * 1024**3,
    work_root: Path | None = None,
) -> dict[str, Any]:
    """Download authorized Level-2 objects (if budget allows) and run A/B extracts."""
    idxs = indexes or LEVEL2_OBJECT_INDEXES
    budget = level2_byte_budget(idxs)
    if budget["total_bytes"] > max_total_bytes:
        report = {
            "status": "LEVEL2_REAL_PENDING",
            "reason": "total_bytes_exceeds_task_budget",
            "budget": budget,
            "objects": [],
            "all_byte_identical": False,
        }
        write_json(LEVEL2_REPORT, report)
        return report

    inv = load_pinned_object_inventory()
    root = Path(work_root) if work_root else REPO_ROOT / "data" / "paper3" / "bootstrap" / "level2_runs"
    root.mkdir(parents=True, exist_ok=True)
    LEVEL2_CACHE.mkdir(parents=True, exist_ok=True)

    results: list[dict[str, Any]] = []
    for i in idxs:
        meta = inv["objects"][i]
        local = LEVEL2_CACHE / f"object_{i:04d}.parquet"
        if not local.is_file() or local.stat().st_size != meta["content_length"]:
            fetched = _fetch_object(meta["s3_key"], local)
        else:
            fetched = {"local_bytes": local.stat().st_size, "etag": None, "cached": True}
        if local.stat().st_size != meta["content_length"]:
            raise RuntimeError(
                f"size mismatch object {i}: local={local.stat().st_size} "
                f"manifest={meta['content_length']}"
            )

        run_rows = []
        for run_id, label in ((1, "a"), (2, "b")):
            # Fresh roots each run — never resume across A/B for this probe.
            stamp = f"{label}{run_id}_{int(time.time())}"
            stage_root = root / f"object_{i:04d}" / f"run_{stamp}" / "stage1"
            ck_path = root / f"object_{i:04d}" / f"run_{stamp}" / "ckpt.json"
            ck = CheckpointStore(ck_path)
            t0 = time.perf_counter()
            out = process_local_works_object(
                object_index=i,
                local_parquet=local,
                checkpoint=ck,
                stage1_root=stage_root,
                minimum_free_space_bytes=1,
                input_meta=meta,
            )
            elapsed = time.perf_counter() - t0
            if out.get("skipped"):
                entry = out.get("entry") or {}
                shards = entry.get("output_shards") or []
                sha = (shards[0] or {}).get("sha256") if shards else entry.get("output_sha256")
                rows = entry.get("rows_retained")
                nbytes = (shards[0] or {}).get("bytes") if shards else None
            else:
                sha = out["written"]["sha256"]
                rows = out["stats"]["output_rows"]
                nbytes = out["written"]["bytes"]
            run_rows.append(
                {
                    "run": label,
                    "sha256": sha,
                    "rows_retained": rows,
                    "output_bytes": nbytes,
                    "runtime_seconds": round(elapsed, 3),
                    "cached_skip": bool(out.get("skipped")),
                }
            )

        a, b = run_rows[0], run_rows[1]
        results.append(
            {
                "object_index": i,
                "object_key": meta["s3_key"],
                "input_size": meta["content_length"],
                "fetched": fetched,
                "run_a_sha256": a["sha256"],
                "run_b_sha256": b["sha256"],
                "byte_identical": a["sha256"] == b["sha256"],
                "rows_retained": a["rows_retained"],
                "output_bytes": a["output_bytes"],
                "runtime_a": a["runtime_seconds"],
                "runtime_b": b["runtime_seconds"],
            }
        )

    all_ok = all(r["byte_identical"] for r in results)
    report = {
        "status": "LEVEL2_PASS" if all_ok else "LEVEL2_FAIL",
        "budget": budget,
        "docker_image": "paper3-acquisition:0.2.0",
        "n_objects_tested": len(results),
        "all_byte_identical": all_ok,
        "objects": results,
        "full_works_scan_started": False,
        "prohibited_outcomes_computed": False,
    }
    write_json(LEVEL2_REPORT, report)
    return report
