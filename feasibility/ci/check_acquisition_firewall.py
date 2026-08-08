#!/usr/bin/env python3
"""Acquisition-oriented static checks layered on the Phase-0 firewall.

Runs:
  1) feasibility/ci/firewall_check.py logic (imported)
  2) no-raw-writes gate
  3) sealed spec binding
"""

from __future__ import annotations

import runpy
import sys
from pathlib import Path

CI = Path(__file__).resolve().parent


def _run(script: str) -> int:
    ns = runpy.run_path(str(CI / script), run_name="__main__")
    # scripts call SystemExit via main; run_path executes main only if __main__
    # Our scripts use `if __name__ == "__main__"` so run_path with run_name
    # __main__ will execute them. Capture via subprocess instead for clarity.
    return 0 if ns is not None else 0


def main() -> int:
    import subprocess

    checks = [
        "firewall_check.py",
        "check_acquisition_no_raw_writes.py",
        "check_acquisition_spec_binding.py",
    ]
    failed = 0
    for name in checks:
        print(f"--- {name} ---")
        proc = subprocess.run([sys.executable, str(CI / name)], check=False)
        if proc.returncode != 0:
            failed += 1
    if failed:
        print(f"ACQUISITION FIREWALL BUNDLE: FAIL ({failed} check(s))")
        return 1
    print("ACQUISITION FIREWALL BUNDLE: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
