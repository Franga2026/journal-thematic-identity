from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.acquisition.constants import (
    EXPECTED_WORKS_OBJECTS,
    WORKS_MANIFEST_SHA256,
)
from src.acquisition.errors import ManifestMismatchError
from src.acquisition.object_inventory import (
    load_pinned_object_inventory,
    write_raw_object_inventory,
)


def test_valid_manifest_binding_and_order():
    inv = load_pinned_object_inventory()
    assert inv["expected_objects"] == EXPECTED_WORKS_OBJECTS
    assert inv["works_manifest_sha256"] == WORKS_MANIFEST_SHA256
    urls = [o["url"] for o in inv["objects"]]
    assert urls == sorted(urls)
    assert inv["objects"][0]["object_index"] == 0
    assert inv["objects"][-1]["object_index"] == EXPECTED_WORKS_OBJECTS - 1
    assert inv["objects"][0]["url"].endswith(".parquet")


def test_wrong_manifest_sha(tmp_path: Path):
    bad = tmp_path / "bad_manifest.json"
    bad.write_text(
        json.dumps(
            {
                "date": "2026-06-26",
                "format": "parquet",
                "entity": "works",
                "record_count": 1,
                "content_length": 1,
                "files": [
                    {
                        "url": "s3://openalex/data/parquet/works/updated_date=2016-06-24/part_0000.parquet",
                        "meta": {"content_length": 1, "record_count": 1},
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(ManifestMismatchError, match="SHA-256 mismatch"):
        load_pinned_object_inventory(bad, expected_count=1)


def test_duplicate_key_inventory(tmp_path: Path):
    # Craft a tiny fake inventory loader path by monkeypatching expected count
    url = "s3://openalex/data/parquet/works/updated_date=2016-06-24/part_0000.parquet"
    payload = {
        "date": "2026-06-26",
        "format": "parquet",
        "entity": "works",
        "record_count": 2,
        "content_length": 2,
        "files": [
            {"url": url, "meta": {"content_length": 1, "record_count": 1}},
            {"url": url, "meta": {"content_length": 1, "record_count": 1}},
        ],
    }
    bad = tmp_path / "dup.json"
    bad.write_text(json.dumps(payload), encoding="utf-8")
    # SHA won't match sealed hash — that fails first. Use expected_sha256=actual.
    import hashlib

    sha = hashlib.sha256(bad.read_bytes()).hexdigest()
    with pytest.raises(ManifestMismatchError, match="Duplicate object key"):
        load_pinned_object_inventory(bad, expected_sha256=sha, expected_count=2)


def test_write_raw_object_inventory(tmp_path: Path):
    dest = tmp_path / "raw_object_inventory.json"
    path = write_raw_object_inventory(dest=dest)
    assert path.is_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["expected_objects"] == EXPECTED_WORKS_OBJECTS
    assert "inventory_sha256" in data
