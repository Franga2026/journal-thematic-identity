"""Runtime firewall guards for Pipeline A (Phase 0).

These guards enforce, at execution time, the blinding rules of the sealed
protocol (v1.1, SHA-256 871b75fe...fdb8), sections 1.1-1.3 and 8. They are
complementary to the *static* CI check in ``ci/firewall_check.py``: the CI
refuses to let prohibited code exist; these guards refuse to let prohibited
data be written even if some future edit slips past the static scan.

Nothing here computes an outcome. The guards only *reject* outcome-bearing
material. The list of prohibited tokens is loaded from data
(``ci/prohibited_symbols.txt``) so this source file itself contains none of
them as literals.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

_ROOT = Path(__file__).resolve().parents[1]
_PROHIBITED_FILE = _ROOT / "ci" / "prohibited_symbols.txt"
_PERMITTED_FILE = _ROOT / "ci" / "permitted_outputs.txt"


class ContaminationError(RuntimeError):
    """Raised when Pipeline A attempts a prohibited computation or output.

    Per protocol section 1.3, raising this means Phase 0 is contaminated: the
    incident must be logged, contaminated artifacts cannot back the
    preregistration, and a clean rerun from the sealed snapshot is required.
    """


def _load_tokens(path: Path) -> list[str]:
    tokens: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        tokens.append(line.lower())
    return tokens


def prohibited_tokens() -> list[str]:
    """The prohibited-symbol vocabulary (lowercased), loaded from data."""
    return _load_tokens(_PROHIBITED_FILE)


def permitted_outputs() -> set[str]:
    """The allowlisted output filenames, loaded from data."""
    return set(_load_tokens(_PERMITTED_FILE))


def scan_text_for_prohibited(text: str) -> list[str]:
    """Return every prohibited token that appears (as a substring) in *text*.

    Used to vet column names and free string values, not prose. Case-insensitive.
    """
    low = text.lower()
    return [tok for tok in prohibited_tokens() if tok in low]


def assert_clean_columns(columns: Iterable[str]) -> None:
    """Reject any dataframe column whose name carries a prohibited token."""
    hits: list[str] = []
    for col in columns:
        found = scan_text_for_prohibited(str(col))
        if found:
            hits.append(f"{col!r} -> {found}")
    if hits:
        raise ContaminationError(
            "Column names carry outcome-bearing tokens forbidden in Phase 0: "
            + "; ".join(hits)
        )


def assert_permitted_output(name: str) -> None:
    """Reject any output filename not on the sealed allowlist (protocol section 8)."""
    if name not in permitted_outputs():
        raise ContaminationError(
            f"Output {name!r} is not on the permitted-output allowlist. "
            "Only aggregate/marginal files named in ci/permitted_outputs.txt "
            "may leave Pipeline A."
        )


# Column-name patterns that would indicate a per-journal-per-window identity or
# position *series* is being emitted (as opposed to marginal availability).
_SERIES_PATTERNS = (
    re.compile(r"^i_\w*_t\d*$", re.I),
    re.compile(r"^p_\w*_t\d*$", re.I),
    re.compile(r"subfield_.*_share_j", re.I),
)

# Per-work / thematic-vector leakage into feasibility/out/ (aggregate channel).
_PER_WORK_COL_NAMES = frozenset(
    {
        "work_id",
        "openalex_work_id",
        "work_openalex_id",
        "referenced_works",
        "abstract_inverted_index",
        "topic_ids",
        "subfield_ids",
        "primary_topic_id",
        "primary_subfield_id",
    }
)

_TOPIC_VECTOR_PATTERNS = (
    re.compile(r"topic_.*_share", re.I),
    re.compile(r"subfield_.*_share", re.I),
    re.compile(r".*_share_j$", re.I),
)


def assert_not_series(columns: Iterable[str]) -> None:
    """Reject columns that look like a per-journal time series."""
    bad = [c for c in columns if any(p.search(str(c)) for p in _SERIES_PATTERNS)]
    if bad:
        raise ContaminationError(
            "Columns resemble a per-journal identity/position time series, "
            f"which Phase 0 must never emit: {bad}"
        )


def assert_aggregate_grain(columns: Iterable[str]) -> None:
    """Reject per-work rows or thematic-vector columns in feasibility/out/."""
    cols = [str(c) for c in columns]
    low = {c.lower() for c in cols}
    leaked = sorted(low & {x.lower() for x in _PER_WORK_COL_NAMES})
    if leaked:
        raise ContaminationError(
            "feasibility/out/ must not contain per-work columns: "
            f"{leaked}"
        )
    vect = [c for c in cols if any(p.search(c) for p in _TOPIC_VECTOR_PATTERNS)]
    if vect:
        raise ContaminationError(
            "feasibility/out/ must not contain thematic-vector columns: "
            f"{vect}"
        )
    # journal x window grain
    if "journal_id" in low and ("window" in low or "window_id" in low or "t" in low):
        raise ContaminationError(
            "feasibility/out/ must not contain journal x window grain"
        )
