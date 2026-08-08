"""Deterministic WORKS object inventory from the pinned manifest."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from .constants import (
    EXPECTED_WORKS_OBJECTS,
    OPENALEX_MANIFEST_DATE,
    OPENALEX_RELEASE_NOTES_DATE,
    PINNED_WORKS_MANIFEST,
    RAW_OBJECT_INVENTORY,
    WORKS_MANIFEST_SHA256,
    WORKS_TOTAL_CONTENT_LENGTH,
)
from .errors import ManifestMismatchError

_UPDATED_DATE_RE = re.compile(r"updated_date=(\d{4}-\d{2}-\d{2})")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_json_bytes(payload: Any) -> bytes:
    return (json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=True) + "\n").encode(
        "utf-8"
    )


def _url_to_key(url: str) -> str:
    prefix = "s3://openalex/"
    if url.startswith(prefix):
        return url[len(prefix) :]
    return url


def _updated_date_from_url(url: str) -> str | None:
    m = _UPDATED_DATE_RE.search(url)
    return m.group(1) if m else None


def load_pinned_object_inventory(
    manifest_path: Path | None = None,
    *,
    expected_sha256: str = WORKS_MANIFEST_SHA256,
    expected_count: int = EXPECTED_WORKS_OBJECTS,
) -> dict[str, Any]:
    """Load and validate the pinned WORKS parquet object inventory.

    Ordering rule (fixed before content read): lexicographic sort of object URLs.
    """
    path = Path(manifest_path) if manifest_path else PINNED_WORKS_MANIFEST
    if not path.is_file():
        raise ManifestMismatchError(f"Pinned WORKS manifest missing: {path}")

    actual_sha = sha256_file(path)
    if actual_sha != expected_sha256:
        raise ManifestMismatchError(
            f"WORKS manifest SHA-256 mismatch: got {actual_sha}, "
            f"expected {expected_sha256}"
        )

    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest.get("date") != OPENALEX_MANIFEST_DATE:
        raise ManifestMismatchError(
            f"manifest.date mismatch: {manifest.get('date')!r}"
        )
    if manifest.get("entity") != "works" or manifest.get("format") != "parquet":
        raise ManifestMismatchError("manifest entity/format is not works/parquet")

    files = manifest.get("files")
    if not isinstance(files, list):
        raise ManifestMismatchError("manifest.files must be a list")

    ordered = sorted(files, key=lambda f: str(f.get("url", "")))
    objects: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    for idx, entry in enumerate(ordered):
        url = str(entry.get("url", ""))
        if not url.endswith(".parquet"):
            raise ManifestMismatchError(
                f"Non-parquet URL in WORKS inventory at sorted position {idx}: {url}"
            )
        key = _url_to_key(url)
        if key in seen_keys:
            raise ManifestMismatchError(f"Duplicate object key in inventory: {key}")
        seen_keys.add(key)
        meta = entry.get("meta") or {}
        objects.append(
            {
                "object_index": idx,
                "url": url,
                "s3_key": key,
                "content_length": int(meta.get("content_length") or 0),
                "record_count": int(meta.get("record_count") or 0),
                "etag": meta.get("etag"),
                "checksum_metadata": {
                    "etag": meta.get("etag"),
                    "note": "ETag is not SHA-256 of remote object",
                },
                "manifest_date": OPENALEX_MANIFEST_DATE,
                "release_notes_date": OPENALEX_RELEASE_NOTES_DATE,
                "updated_date_partition": _updated_date_from_url(url),
            }
        )

    if len(objects) != expected_count:
        raise ManifestMismatchError(
            f"object count {len(objects)} != expected {expected_count}"
        )

    # Reproducibility of canonical order
    urls = [o["url"] for o in objects]
    if urls != sorted(urls):
        raise ManifestMismatchError("canonical lexicographic order not reproducible")

    total_len = sum(o["content_length"] for o in objects)
    if total_len != int(manifest.get("content_length") or 0):
        raise ManifestMismatchError(
            "sum(content_length) does not match manifest.content_length"
        )
    if total_len != WORKS_TOTAL_CONTENT_LENGTH:
        raise ManifestMismatchError(
            "total content_length does not match sealed WORKS_TOTAL_CONTENT_LENGTH"
        )

    inventory = {
        "inventory_version": "1.0",
        "entity": "works",
        "format": "parquet",
        "manifest_date": OPENALEX_MANIFEST_DATE,
        "release_notes_tag": OPENALEX_RELEASE_NOTES_DATE,
        "works_manifest_sha256": actual_sha,
        "works_manifest_path": str(path),
        "selection_rule": "lexicographic_sort_of_manifest_file_urls",
        "expected_objects": expected_count,
        "works_total_content_length": total_len,
        "record_count": int(manifest.get("record_count") or 0),
        "objects": objects,
    }
    inv_bytes = canonical_json_bytes(inventory)
    inventory["inventory_sha256"] = sha256_bytes(inv_bytes)
    return inventory


def write_raw_object_inventory(
    inventory: dict[str, Any] | None = None,
    dest: Path | None = None,
) -> Path:
    """Persist Layer A logical inventory (from pinned local manifest; no S3 scan)."""
    inv = inventory if inventory is not None else load_pinned_object_inventory()
    from .sanctioned_io import write_bytes

    out = Path(dest) if dest else RAW_OBJECT_INVENTORY
    # Drop self-hash before rewrite for stable body, then recompute
    body = {k: v for k, v in inv.items() if k != "inventory_sha256"}
    raw = canonical_json_bytes(body)
    body["inventory_sha256"] = sha256_bytes(raw)
    write_bytes(out, canonical_json_bytes(body))
    return out
