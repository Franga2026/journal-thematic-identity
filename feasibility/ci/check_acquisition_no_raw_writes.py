#!/usr/bin/env python3
"""Reject unsanctioned parquet/text/numpy write calls under feasibility/src.

Allowed modules that may call low-level writers:
  - src/acquisition/deterministic_writer.py  (Layer B)
  - src/writers.py                           (Phase-0 / bootstrap sanctioned exits)

Patterns banned elsewhere:
  .to_parquet(
  pq.write_table(
  write_dataset(
  Path(...).write_text(  — checked as .write_text(
  np.save(
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

FEAS = Path(__file__).resolve().parents[1]
SRC = FEAS / "src"

ALLOWED = {
    SRC / "acquisition" / "deterministic_writer.py",
    SRC / "acquisition" / "sanctioned_io.py",
    SRC / "writers.py",
}

PATTERNS = [
    re.compile(r"\.to_parquet\s*\("),
    re.compile(r"pq\.write_table\s*\("),
    re.compile(r"write_dataset\s*\("),
    re.compile(r"\.write_text\s*\("),
    re.compile(r"np\.save\s*\("),
]


def main() -> int:
    findings: list[str] = []
    for path in sorted(SRC.rglob("*.py")):
        if path in ALLOWED:
            continue
        text = path.read_text(encoding="utf-8")
        for i, line in enumerate(text.splitlines(), 1):
            # Skip comments
            stripped = line.lstrip()
            if stripped.startswith("#"):
                continue
            for pat in PATTERNS:
                if pat.search(line):
                    rel = path.relative_to(FEAS.parent)
                    findings.append(f"{rel}:{i}: {line.strip()}")
    if findings:
        print("ACQUISITION RAW-WRITE CHECK: FAIL")
        for f in findings:
            print("  -", f)
        return 1
    print("ACQUISITION RAW-WRITE CHECK: PASS")
    print(f"  scanned {len(list(SRC.rglob('*.py')))} files; allowed writers: {len(ALLOWED)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
