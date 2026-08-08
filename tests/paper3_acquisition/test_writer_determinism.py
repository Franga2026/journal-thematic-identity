from __future__ import annotations

from pathlib import Path

from src.acquisition.deterministic_writer import write_deterministic_parquet
from src.acquisition.extractor import slim_from_works_table
from make_synthetic_works import make_works_table


def test_writer_byte_determinism(tmp_path: Path):
    table = make_works_table(
        [
            {
                "id": "https://openalex.org/W2",
                "publication_year": 2010,
                "source_id": "https://openalex.org/S1",
                "primary_topic_id": "https://openalex.org/T2",
                "primary_subfield_id": "https://openalex.org/subfields/2",
                "topic_assignments": [
                    {"topic_id": "https://openalex.org/T2", "score": 0.5},
                    {"topic_id": "https://openalex.org/T1", "score": 0.2},
                ],
                "abstract_inverted_index": '{"a":[1]}',
                "referenced_works_count": 3,
                "counts_by_year": [{"year": 2011, "cited_by_count": 2}],
            },
            {
                "id": "https://openalex.org/W1",
                "publication_year": 2005,
                "source_id": "https://openalex.org/S1",
                "abstract_inverted_index": None,
                "referenced_works_count": 0,
            },
        ]
    )
    slim, _ = slim_from_works_table(table)
    a = write_deterministic_parquet(slim, tmp_path / "a.parquet")
    b = write_deterministic_parquet(slim, tmp_path / "b.parquet")
    assert a["sha256"] == b["sha256"]
    assert a["rows"] == 2
    # Canonical row order: W1 before W2
    assert slim.column("work_id")[0].as_py().endswith("W1")
