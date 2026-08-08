from __future__ import annotations

from pathlib import Path

from src.acquisition.taxonomy_binding import (
    build_canonical_topic_taxonomy,
    canonicalize_taxonomy_rows,
    write_canonical_topic_taxonomy,
)


def test_taxonomy_canonicalization(tmp_path: Path):
    rows = [
        {
            "topic_id": "T2",
            "topic_name": "b",
            "subfield_id": "SF1",
            "subfield_name": "s",
            "field_id": "F1",
            "field_name": "f",
            "domain_id": "D1",
            "domain_name": "d",
        },
        {
            "topic_id": "T1",
            "topic_name": "a",
            "subfield_id": "SF1",
            "subfield_name": "s",
            "field_id": "F1",
            "field_name": "f",
            "domain_id": "D1",
            "domain_name": "d",
        },
    ]
    ordered = canonicalize_taxonomy_rows(rows)
    assert [r["topic_id"] for r in ordered] == ["T1", "T2"]
    built = build_canonical_topic_taxonomy(rows)
    assert "taxonomy_hash" in built
    path, digest = write_canonical_topic_taxonomy(rows, dest=tmp_path / "canonical_topic_taxonomy.json")
    assert path.is_file()
    assert digest == built["taxonomy_hash"]
