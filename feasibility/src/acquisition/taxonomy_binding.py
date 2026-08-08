"""Canonical topic taxonomy binding (names only; no journal aggregation)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .constants import CANONICAL_TAXONOMY_PATH
from .object_inventory import canonical_json_bytes, sha256_bytes


TAXONOMY_FIELDS = (
    "topic_id",
    "topic_name",
    "subfield_id",
    "subfield_name",
    "field_id",
    "field_name",
    "domain_id",
    "domain_name",
)


def canonicalize_taxonomy_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sort by topic_id; keep only locked fields; coerce strings."""
    cleaned: list[dict[str, Any]] = []
    for r in rows:
        item = {k: (None if r.get(k) is None else str(r.get(k))) for k in TAXONOMY_FIELDS}
        if not item["topic_id"]:
            continue
        cleaned.append(item)
    cleaned.sort(key=lambda d: d["topic_id"])
    return cleaned


def build_canonical_topic_taxonomy(rows: list[dict[str, Any]]) -> dict[str, Any]:
    topics = canonicalize_taxonomy_rows(rows)
    body = {
        "taxonomy_version": "1.0",
        "ordering": "topic_id_asc",
        "topics": topics,
    }
    raw = canonical_json_bytes(body)
    return {
        **body,
        "taxonomy_hash": sha256_bytes(raw),
    }


def write_canonical_topic_taxonomy(
    rows: list[dict[str, Any]],
    dest: Path | None = None,
) -> tuple[Path, str]:
    """Write canonical taxonomy JSON; hashed body excludes the hash field."""
    from .sanctioned_io import write_bytes, write_text

    path = Path(dest) if dest else CANONICAL_TAXONOMY_PATH
    topics = canonicalize_taxonomy_rows(rows)
    body = {
        "taxonomy_version": "1.0",
        "ordering": "topic_id_asc",
        "topics": topics,
    }
    digest = sha256_bytes(canonical_json_bytes(body))
    write_bytes(path, canonical_json_bytes(body))
    write_text(path.with_suffix(path.suffix + ".sha256"), digest + "  " + path.name + "\n")
    return path, digest


def load_taxonomy_hash(path: Path | None = None) -> str | None:
    path = Path(path) if path else CANONICAL_TAXONOMY_PATH
    sha_side = path.with_suffix(path.suffix + ".sha256")
    if sha_side.is_file():
        return sha_side.read_text(encoding="utf-8").split()[0]
    if not path.is_file():
        return None
    payload = json.loads(path.read_text(encoding="utf-8"))
    body = {k: v for k, v in payload.items() if k != "taxonomy_hash"}
    return sha256_bytes(canonical_json_bytes(body))
