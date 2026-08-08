"""SOURCES release binding verifier (no silent use of unverified trees)."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from .constants import OPENALEX_MANIFEST_DATE, OPENALEX_RELEASE_NOTES_DATE
from .errors import SourceBindingError
from .object_inventory import canonical_json_bytes, sha256_bytes

STATUS_VERIFIED = "VERIFIED_SOURCE_BINDING"
STATUS_UNVERIFIED = "UNVERIFIED_SOURCE_BINDING"


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_sources_binding(
    *,
    sources_manifest_path: Path | None = None,
    sources_dir: Path | None = None,
    expected_manifest_date: str = OPENALEX_MANIFEST_DATE,
    expected_release_notes_date: str = OPENALEX_RELEASE_NOTES_DATE,
    expected_file_inventory: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Verify SOURCES compatibility with the pinned WORKS release family.

    Returns a binding record. If compatibility cannot be proven, status is
    UNVERIFIED_SOURCE_BINDING (never silently treated as canonical).
    """
    result: dict[str, Any] = {
        "status": STATUS_UNVERIFIED,
        "manifest_date": None,
        "release_notes_date": expected_release_notes_date,
        "sources_manifest_sha256": None,
        "n_files_local": None,
        "n_files_manifest": None,
        "content_length_local": None,
        "content_length_manifest": None,
        "reasons": [],
    }

    if sources_manifest_path is None or not Path(sources_manifest_path).is_file():
        result["reasons"].append("sources_manifest_missing")
        return result

    man_path = Path(sources_manifest_path)
    man_sha = _sha256_file(man_path)
    result["sources_manifest_sha256"] = man_sha
    manifest = json.loads(man_path.read_text(encoding="utf-8"))
    result["manifest_date"] = manifest.get("date")
    if manifest.get("date") != expected_manifest_date:
        result["reasons"].append(
            f"manifest.date {manifest.get('date')!r} != {expected_manifest_date!r}"
        )
        return result
    entity = manifest.get("entity")
    if entity is not None and entity != "sources":
        result["reasons"].append(f"unexpected entity {entity!r}")
        return result

    files = manifest.get("files") or []
    result["n_files_manifest"] = len(files)
    result["content_length_manifest"] = int(manifest.get("content_length") or 0)

    if expected_file_inventory is not None:
        # Explicit inventory with per-file hashes (fixture / production pin)
        if len(expected_file_inventory) != len(files):
            result["reasons"].append("file_inventory_count_mismatch")
            return result
        for item in expected_file_inventory:
            p = Path(item["path"])
            if not p.is_file():
                result["reasons"].append(f"missing_file:{p}")
                return result
            actual = _sha256_file(p)
            if actual != item.get("sha256"):
                result["reasons"].append(f"hash_mismatch:{p.name}")
                return result
        result["status"] = STATUS_VERIFIED
        result["reasons"].append("per_file_hashes_matched")
        return result

    if sources_dir is not None and Path(sources_dir).is_dir():
        local_files = sorted(
            [p for p in Path(sources_dir).rglob("*") if p.is_file() and p.suffix == ".parquet"]
        )
        result["n_files_local"] = len(local_files)
        result["content_length_local"] = sum(p.stat().st_size for p in local_files)
        # Size+count match is necessary but not sufficient without per-file hashes.
        if (
            result["n_files_local"] == result["n_files_manifest"]
            and result["content_length_local"] == result["content_length_manifest"]
        ):
            result["reasons"].append(
                "byte_total_and_count_match_but_per_file_hashes_absent"
            )
            result["status"] = STATUS_UNVERIFIED
            return result
        result["reasons"].append("local_sources_size_or_count_mismatch")
        return result

    result["reasons"].append("no_sources_dir_or_hash_inventory")
    return result


def assert_verified_sources_binding(binding: dict[str, Any]) -> None:
    if binding.get("status") != STATUS_VERIFIED:
        raise SourceBindingError(
            f"SOURCES binding not verified: status={binding.get('status')} "
            f"reasons={binding.get('reasons')}"
        )


def binding_record_sha256(binding: dict[str, Any]) -> str:
    return sha256_bytes(canonical_json_bytes(binding))
