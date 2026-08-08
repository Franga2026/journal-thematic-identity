from __future__ import annotations

import hashlib
import json
from pathlib import Path

from src.acquisition.sources_binding import (
    STATUS_UNVERIFIED,
    STATUS_VERIFIED,
    assert_verified_sources_binding,
    verify_sources_binding,
)
from src.acquisition.errors import SourceBindingError
import pytest


def test_unverified_without_hashes(tmp_path: Path):
    man = tmp_path / "sources_manifest.json"
    f1 = tmp_path / "part.parquet"
    f1.write_bytes(b"abc")
    man.write_text(
        json.dumps(
            {
                "date": "2026-06-26",
                "format": "parquet",
                "entity": "sources",
                "record_count": 1,
                "content_length": 3,
                "files": [
                    {
                        "url": "s3://openalex/data/parquet/sources/x.parquet",
                        "meta": {"content_length": 3, "record_count": 1},
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    binding = verify_sources_binding(
        sources_manifest_path=man,
        sources_dir=tmp_path,
    )
    assert binding["status"] == STATUS_UNVERIFIED
    assert "per_file_hashes_absent" in ",".join(binding["reasons"])


def test_verified_with_hash_inventory(tmp_path: Path):
    f1 = tmp_path / "part.parquet"
    f1.write_bytes(b"abc")
    man = tmp_path / "sources_manifest.json"
    man.write_text(
        json.dumps(
            {
                "date": "2026-06-26",
                "format": "parquet",
                "entity": "sources",
                "record_count": 1,
                "content_length": 3,
                "files": [
                    {
                        "url": "s3://openalex/data/parquet/sources/x.parquet",
                        "meta": {"content_length": 3, "record_count": 1},
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    sha = hashlib.sha256(b"abc").hexdigest()
    binding = verify_sources_binding(
        sources_manifest_path=man,
        expected_file_inventory=[{"path": str(f1), "sha256": sha}],
    )
    assert binding["status"] == STATUS_VERIFIED
    assert_verified_sources_binding(binding)


def test_assert_verified_raises():
    with pytest.raises(SourceBindingError):
        assert_verified_sources_binding({"status": STATUS_UNVERIFIED, "reasons": ["x"]})
