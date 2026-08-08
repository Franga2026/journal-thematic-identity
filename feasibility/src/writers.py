"""The only sanctioned exit for Phase-0 data.

All permitted outputs (protocol section 8) leave Pipeline A through
``write_permitted``. It enforces guards before a byte is written.

Bootstrap technical artifacts (one-partition pilot inputs) leave through
``write_bootstrap_*`` into ``data/paper3/bootstrap/`` — never into
``feasibility/out/``. That path is an allowlisted technical channel, not a
general raw-write bypass.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from . import firewall

_ROOT = Path(__file__).resolve().parents[1]
_REPO = _ROOT.parent
OUT_DIR = _ROOT / "out"
RESTRICTED_DIR = _ROOT / "tmp_restricted"
BOOTSTRAP_DIR = _REPO / "data" / "paper3" / "bootstrap"

# Technical pilot artifacts only (SliceSpec v0.2). Not analysis outputs.
BOOTSTRAP_ALLOWLIST = frozenset(
    {
        "works_slim_pilot.parquet",
        "pilot_input_manifest.json",
        "pilot_schema.json",
        "pilot_checksums.sha256",
        "pilot_acquisition_report.json",
        "works_manifest.pinned.json",
        "selected_object.raw.parquet",
    }
)

_KEEP_IN_RESTRICTED = frozenset({".gitignore", ".gitkeep"})


def write_permitted(df: pd.DataFrame, name: str) -> Path:
    """Validate and write an allowlisted aggregate/marginal output to out/."""
    firewall.assert_permitted_output(name)
    firewall.assert_clean_columns(df.columns)
    firewall.assert_not_series(df.columns)
    firewall.assert_aggregate_grain(df.columns)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / name
    df.to_csv(dest, index=False, lineterminator="\n")
    return dest


def write_restricted(df: pd.DataFrame, name: str) -> Path:
    """Write a granular intermediate to tmp_restricted/ (never shareable)."""
    RESTRICTED_DIR.mkdir(parents=True, exist_ok=True)
    dest = RESTRICTED_DIR / name
    df.to_csv(dest, index=False, lineterminator="\n")
    return dest


def purge_restricted() -> list[str]:
    """Delete granular intermediates; keep .gitignore / .gitkeep."""
    removed: list[str] = []
    if RESTRICTED_DIR.exists():
        for p in sorted(RESTRICTED_DIR.iterdir()):
            if p.is_file() and p.name not in _KEEP_IN_RESTRICTED:
                p.unlink()
                removed.append(p.name)
    return removed


def assert_restricted_purged() -> None:
    """Fail if tmp_restricted/ still holds residual data files."""
    if not RESTRICTED_DIR.exists():
        return
    leftover = [
        p.name
        for p in sorted(RESTRICTED_DIR.iterdir())
        if p.is_file() and p.name not in _KEEP_IN_RESTRICTED
    ]
    if leftover:
        raise firewall.ContaminationError(
            "tmp_restricted/ not empty after purge: " + ", ".join(leftover)
        )


def write_bootstrap_bytes(name: str, data: bytes) -> Path:
    """Write a bootstrap allowlisted binary artifact (e.g. raw object copy)."""
    if name not in BOOTSTRAP_ALLOWLIST:
        raise firewall.ContaminationError(
            f"Bootstrap artifact {name!r} not on bootstrap allowlist"
        )
    BOOTSTRAP_DIR.mkdir(parents=True, exist_ok=True)
    dest = BOOTSTRAP_DIR / name
    dest.write_bytes(data)
    return dest


def write_bootstrap_json(name: str, payload: dict[str, Any]) -> Path:
    """Write a bootstrap allowlisted JSON artifact (deterministic separators)."""
    if name not in BOOTSTRAP_ALLOWLIST:
        raise firewall.ContaminationError(
            f"Bootstrap artifact {name!r} not on bootstrap allowlist"
        )
    BOOTSTRAP_DIR.mkdir(parents=True, exist_ok=True)
    dest = BOOTSTRAP_DIR / name
    text = json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=True) + "\n"
    dest.write_text(text, encoding="utf-8")
    return dest


def write_bootstrap_parquet(name: str, table: pa.Table) -> Path:
    """Write a deterministic bootstrap parquet (pilot slim works only)."""
    if name not in BOOTSTRAP_ALLOWLIST:
        raise firewall.ContaminationError(
            f"Bootstrap artifact {name!r} not on bootstrap allowlist"
        )
    # Reject prohibited column tokens even on bootstrap technical channel.
    firewall.assert_clean_columns(table.column_names)
    BOOTSTRAP_DIR.mkdir(parents=True, exist_ok=True)
    dest = BOOTSTRAP_DIR / name
    pq.write_table(
        table,
        dest,
        compression="zstd",
        compression_level=3,
        use_dictionary=False,
        write_statistics=False,
        store_schema=True,
        data_page_version="1.0",
    )
    return dest


def write_bootstrap_text(name: str, text: str) -> Path:
    """Write bootstrap checksums / small text files."""
    if name not in BOOTSTRAP_ALLOWLIST:
        raise firewall.ContaminationError(
            f"Bootstrap artifact {name!r} not on bootstrap allowlist"
        )
    BOOTSTRAP_DIR.mkdir(parents=True, exist_ok=True)
    dest = BOOTSTRAP_DIR / name
    dest.write_text(text if text.endswith("\n") else text + "\n", encoding="utf-8")
    return dest


def write_permitted_json(payload: dict[str, Any], name: str) -> Path:
    """Write an allowlisted JSON aggregate (e.g. ldam_manifest.json) to out/."""
    firewall.assert_permitted_output(name)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / name
    text = json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=True) + "\n"
    dest.write_text(text, encoding="utf-8")
    return dest
