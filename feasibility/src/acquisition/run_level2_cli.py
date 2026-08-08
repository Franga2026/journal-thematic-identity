"""CLI: run Level-2 reproducibility (one index or all predefined)."""

from __future__ import annotations

import argparse
import json
import sys

from .constants import LEVEL2_OBJECT_INDEXES
from .level2_repro import run_level2_reproducibility


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--indexes",
        default=",".join(str(i) for i in LEVEL2_OBJECT_INDEXES),
        help="comma-separated object indexes",
    )
    args = p.parse_args(argv)
    idxs = tuple(int(x) for x in args.indexes.split(",") if x.strip() != "")
    rep = run_level2_reproducibility(indexes=idxs)
    print(json.dumps(rep, indent=2, sort_keys=True))
    return 0 if rep.get("status") in {"LEVEL2_PASS", "LEVEL2_REAL_PENDING"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
