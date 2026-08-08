"""Paper 3 Layer B acquisition executor (streaming WORKS → slim shards).

Implements sealed acquisition spec v1.0. Does not run the full 2446-object
scan unless explicitly invoked with production authorization flags.

This package must remain free of outcome-bearing identifiers banned by the
Phase-0 static firewall (loaded from ``ci/prohibited_symbols.txt``).
"""

from __future__ import annotations

__all__ = ["EXPECTED_WORKS_OBJECTS"]

EXPECTED_WORKS_OBJECTS = 2446
