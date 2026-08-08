from __future__ import annotations

import pytest

from make_synthetic_works import make_works_table
from src.acquisition.duplicate_guard import assert_unique_work_ids
from src.acquisition.errors import DuplicateWorkIdError
from src.acquisition.extractor import slim_from_works_table


def test_duplicate_work_id_is_fatal():
    table = make_works_table(
        [
            {"id": "https://openalex.org/W1", "publication_year": 2010},
            {"id": "https://openalex.org/W1", "publication_year": 2011},
        ]
    )
    with pytest.raises(DuplicateWorkIdError, match="duplicate work_id FATAL"):
        slim_from_works_table(table)


def test_unique_work_ids_pass():
    table = make_works_table(
        [
            {"id": "https://openalex.org/W1", "publication_year": 2010},
            {"id": "https://openalex.org/W2", "publication_year": 2011},
        ]
    )
    slim, _ = slim_from_works_table(table)
    assert_unique_work_ids(slim)
