"""Strict duplicate work_id detection (FATAL; no silent keep/drop)."""

from __future__ import annotations

from collections import Counter
from typing import Iterable

import pyarrow as pa

from .errors import DuplicateWorkIdError


def find_duplicate_work_ids(work_ids: Iterable[str | None]) -> list[str]:
    """Return sorted list of work_id values that occur more than once."""
    counts: Counter[str] = Counter()
    for wid in work_ids:
        if wid is None or wid == "":
            continue
        counts[str(wid)] += 1
    return sorted([k for k, n in counts.items() if n > 1])


def assert_unique_work_ids(
    table: pa.Table,
    *,
    context: str = "",
) -> None:
    """Raise DuplicateWorkIdError if any non-empty work_id repeats."""
    if "work_id" not in table.column_names:
        raise DuplicateWorkIdError("table missing work_id column")
    dups = find_duplicate_work_ids(table.column("work_id").to_pylist())
    if dups:
        sample = dups[:5]
        raise DuplicateWorkIdError(
            f"duplicate work_id FATAL{(' @ ' + context) if context else ''}: "
            f"n_duplicate_ids={len(dups)}; sample={sample}"
        )
