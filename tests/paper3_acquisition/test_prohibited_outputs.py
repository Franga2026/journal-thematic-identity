from __future__ import annotations

from pathlib import Path

import pytest

from src import firewall
from src.firewall import ContaminationError


def test_prohibited_derived_column():
    # Load a banned token from data file (not hardcoded outcome formula).
    tokens = firewall.prohibited_tokens()
    assert "jsd" in tokens
    with pytest.raises(ContaminationError):
        firewall.assert_clean_columns([f"metric_{tokens[tokens.index('jsd')]}_value"])


def test_journal_window_grain_rejected():
    import pandas as pd

    df = pd.DataFrame(
        {
            "journal_id": ["S1"],
            "window_id": ["W0"],
            "n_works": [1],
        }
    )
    with pytest.raises(ContaminationError):
        firewall.assert_aggregate_grain(df.columns)


def test_per_work_not_allowed_in_out():
    import pandas as pd
    from src import writers

    df = pd.DataFrame({"work_id": ["W1"], "publication_year": [2010], "n_works": [1]})
    with pytest.raises(ContaminationError):
        writers.write_permitted(df, "q1_coverage_by_year.csv")


def test_firewall_clean_fixture_columns():
    firewall.assert_clean_columns(
        ["publication_year", "n_works", "share_with_abstract", "has_source"]
    )
