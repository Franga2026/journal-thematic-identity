"""Sanctioned filesystem writes for acquisition manifests / checksums.

Layer B parquet bytes must go through ``deterministic_writer``.
JSON/text provenance artifacts go through this module only.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def write_bytes(path: Path, data: bytes) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(path)
    return path


def write_text(path: Path, text: str) -> Path:
    if not text.endswith("\n"):
        text = text + "\n"
    return write_bytes(path, text.encode("utf-8"))


def write_json(path: Path, payload: Any) -> Path:
    text = json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=True) + "\n"
    return write_text(path, text)
