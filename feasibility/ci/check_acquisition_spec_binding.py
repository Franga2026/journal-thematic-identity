#!/usr/bin/env python3
"""Verify sealed acquisition-spec / protocol / WORKS-manifest bindings."""

from __future__ import annotations

import sys
from pathlib import Path

FEAS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(FEAS))

from src.acquisition.input_binding import verify_spec_binding  # noqa: E402


def main() -> int:
    try:
        binding = verify_spec_binding()
    except Exception as exc:  # noqa: BLE001
        print("ACQUISITION SPEC BINDING: FAIL")
        print(" ", exc)
        return 1
    print("ACQUISITION SPEC BINDING: PASS")
    print(" ", binding)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
