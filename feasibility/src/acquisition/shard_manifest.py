"""Canonical Layer B shards manifest + root hash."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from .constants import SHARDS_MANIFEST_PATH
from .object_inventory import canonical_json_bytes, sha256_bytes


def empty_shards_manifest() -> dict[str, Any]:
    return {
        "manifest_version": "1.0",
        "shards": [],
    }


def shard_record(
    *,
    logical_id: str,
    stage: int,
    source_object_indices: list[int],
    publication_year: int | None,
    rows: int,
    bytes_: int,
    sha256: str,
    schema_sha256: str,
    min_publication_year: int | None,
    max_publication_year: int | None,
) -> dict[str, Any]:
    return {
        "logical_id": logical_id,
        "stage": int(stage),
        "source_object_indices": list(source_object_indices),
        "publication_year": publication_year,
        "rows": int(rows),
        "bytes": int(bytes_),
        "sha256": sha256,
        "schema_sha256": schema_sha256,
        "min_publication_year": min_publication_year,
        "max_publication_year": max_publication_year,
    }


def canonicalize_shards_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    """Return a copy with shards sorted by logical_id; strip volatile keys."""
    shards = sorted(list(manifest.get("shards") or []), key=lambda s: s["logical_id"])
    # Drop timestamps if present — they must not enter the hashed body.
    clean_shards = []
    for s in shards:
        clean = {k: v for k, v in s.items() if not k.endswith("_at") and k != "timestamp"}
        clean_shards.append(clean)
    return {
        "manifest_version": manifest.get("manifest_version", "1.0"),
        "shards": clean_shards,
    }


def shards_manifest_sha256(manifest: dict[str, Any]) -> str:
    body = canonicalize_shards_manifest(manifest)
    return sha256_bytes(canonical_json_bytes(body))


def write_shards_manifest(
    manifest: dict[str, Any],
    dest: Path | None = None,
) -> tuple[Path, str]:
    from .sanctioned_io import write_bytes, write_text

    path = Path(dest) if dest else SHARDS_MANIFEST_PATH
    body = canonicalize_shards_manifest(manifest)
    root = sha256_bytes(canonical_json_bytes(body))
    # Root hash stored beside, not inside, the canonical hashed body file.
    write_bytes(path, canonical_json_bytes(body))
    sha_path = path.with_suffix(path.suffix + ".sha256")
    write_text(sha_path, root + "  " + path.name + "\n")
    return path, root


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with Path(path).open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()
