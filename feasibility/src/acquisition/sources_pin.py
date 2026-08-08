"""Pin SOURCES manifest and build cryptographic local inventory binding."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from .constants import (
    OPENALEX_MANIFEST_DATE,
    OPENALEX_RELEASE_NOTES_DATE,
    RAW_MANIFESTS_DIR,
    REPO_ROOT,
)
from .errors import SourceBindingError
from .object_inventory import canonical_json_bytes, sha256_bytes
from .sanctioned_io import write_bytes, write_json
from .sources_binding import STATUS_UNVERIFIED, STATUS_VERIFIED

SOURCES_MANIFEST_PINNED = RAW_MANIFESTS_DIR / "sources_manifest.pinned.json"
SOURCES_LOCAL_INVENTORY = RAW_MANIFESTS_DIR / "sources_local_inventory.json"
DEFAULT_SOURCES_DIR = REPO_ROOT / "data" / "openalex-snapshot" / "sources"

_LOCAL_NAME_RE = re.compile(
    r"^data__parquet__sources__(updated_date=\d{4}-\d{2}-\d{2})__(part_\d+\.parquet)$"
)


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def local_filename_to_s3_key(name: str) -> str | None:
    m = _LOCAL_NAME_RE.match(name)
    if not m:
        return None
    return f"data/parquet/sources/{m.group(1)}/{m.group(2)}"


def build_sources_local_inventory(
    *,
    sources_dir: Path | None = None,
    sources_manifest_path: Path | None = None,
) -> dict[str, Any]:
    """Hash every local SOURCES parquet and map to pinned manifest keys."""
    man_path = Path(sources_manifest_path or SOURCES_MANIFEST_PINNED)
    src_dir = Path(sources_dir or DEFAULT_SOURCES_DIR)
    if not man_path.is_file():
        raise SourceBindingError(f"sources manifest missing: {man_path}")
    if not src_dir.is_dir():
        raise SourceBindingError(f"sources dir missing: {src_dir}")

    man_sha = _sha256_file(man_path)
    manifest = json.loads(man_path.read_text(encoding="utf-8"))
    if manifest.get("date") != OPENALEX_MANIFEST_DATE:
        raise SourceBindingError(
            f"sources manifest.date {manifest.get('date')!r} != {OPENALEX_MANIFEST_DATE}"
        )
    if manifest.get("entity") != "sources" or manifest.get("format") != "parquet":
        raise SourceBindingError("sources manifest entity/format invalid")

    files = sorted(manifest.get("files") or [], key=lambda f: str(f.get("url", "")))
    by_key: dict[str, dict[str, Any]] = {}
    for idx, entry in enumerate(files):
        url = str(entry["url"])
        key = url.split("s3://openalex/", 1)[-1]
        meta = entry.get("meta") or {}
        by_key[key] = {
            "object_index": idx,
            "url": url,
            "s3_key": key,
            "content_length": int(meta.get("content_length") or 0),
            "record_count": int(meta.get("record_count") or 0),
            "etag": meta.get("etag"),
        }

    local_files = sorted(p for p in src_dir.iterdir() if p.is_file() and p.suffix == ".parquet")
    objects: list[dict[str, Any]] = []
    mapped_keys: set[str] = set()
    reasons: list[str] = []

    for p in local_files:
        key = local_filename_to_s3_key(p.name)
        if key is None:
            reasons.append(f"unmapped_local_name:{p.name}")
            continue
        if key not in by_key:
            reasons.append(f"local_not_in_manifest:{key}")
            continue
        exp = by_key[key]
        local_size = p.stat().st_size
        local_sha = _sha256_file(p)
        size_ok = local_size == exp["content_length"]
        if not size_ok:
            reasons.append(
                f"size_mismatch:{key}:local={local_size}:manifest={exp['content_length']}"
            )
        objects.append(
            {
                "object_index": exp["object_index"],
                "s3_key": key,
                "url": exp["url"],
                "local_path": str(p.relative_to(REPO_ROOT))
                if p.is_relative_to(REPO_ROOT)
                else str(p),
                "manifest_content_length": exp["content_length"],
                "local_bytes": local_size,
                "size_match": size_ok,
                "sha256_local": local_sha,
                "etag": exp.get("etag"),
                "checksum_metadata": {
                    "etag": exp.get("etag"),
                    "note": "ETag is not SHA-256 of remote object",
                    "sha256_of_local_bytes": local_sha,
                },
                "record_count": exp["record_count"],
            }
        )
        mapped_keys.add(key)

    missing = sorted(set(by_key) - mapped_keys)
    for key in missing:
        reasons.append(f"missing_local:{key}")

    objects.sort(key=lambda o: o["object_index"])
    all_sizes_match = all(o["size_match"] for o in objects) and not missing
    n_manifest = len(by_key)
    n_local_mapped = len(objects)
    status = (
        STATUS_VERIFIED
        if (
            n_local_mapped == n_manifest
            and not missing
            and all_sizes_match
            and not any(r.startswith("unmapped_") for r in reasons)
            and man_sha
        )
        else STATUS_UNVERIFIED
    )
    # Verified requires complete 1:1 map + size match + local SHA recorded for every object
    if status == STATUS_VERIFIED:
        reasons = ["per_file_local_sha256_recorded", "sizes_match_manifest", "keys_bijective"]

    body = {
        "inventory_version": "1.0",
        "entity": "sources",
        "manifest_date": OPENALEX_MANIFEST_DATE,
        "release_notes_date": OPENALEX_RELEASE_NOTES_DATE,
        "sources_manifest_path": str(man_path.relative_to(REPO_ROOT)),
        "sources_manifest_sha256": man_sha,
        "sources_dir": str(src_dir.relative_to(REPO_ROOT))
        if src_dir.is_relative_to(REPO_ROOT)
        else str(src_dir),
        "n_files_manifest": n_manifest,
        "n_files_local_mapped": n_local_mapped,
        "content_length_manifest": int(manifest.get("content_length") or 0),
        "content_length_local_sum": sum(o["local_bytes"] for o in objects),
        "binding_status": status,
        "reasons": reasons,
        "objects": objects,
    }
    raw = canonical_json_bytes({k: v for k, v in body.items() if k != "inventory_sha256"})
    body["inventory_sha256"] = sha256_bytes(raw)
    return body


def write_sources_local_inventory(inventory: dict[str, Any] | None = None) -> Path:
    inv = inventory if inventory is not None else build_sources_local_inventory()
    body = {k: v for k, v in inv.items() if k != "inventory_sha256"}
    digest = sha256_bytes(canonical_json_bytes(body))
    body["inventory_sha256"] = digest
    write_bytes(SOURCES_LOCAL_INVENTORY, canonical_json_bytes(body))
    write_bytes(
        SOURCES_LOCAL_INVENTORY.with_suffix(".json.sha256"),
        f"{digest}  {SOURCES_LOCAL_INVENTORY.name}\n".encode("utf-8"),
    )
    return SOURCES_LOCAL_INVENTORY


def verify_pinned_sources_binding() -> dict[str, Any]:
    """Return VERIFIED only when local inventory proves cryptographic bind."""
    inv = build_sources_local_inventory()
    write_sources_local_inventory(inv)
    return {
        "status": inv["binding_status"],
        "sources_manifest_sha256": inv["sources_manifest_sha256"],
        "sources_local_inventory_sha256": inv["inventory_sha256"],
        "n_files_manifest": inv["n_files_manifest"],
        "n_files_local_mapped": inv["n_files_local_mapped"],
        "reasons": inv["reasons"],
        "manifest_date": inv["manifest_date"],
        "release_notes_date": inv["release_notes_date"],
    }
