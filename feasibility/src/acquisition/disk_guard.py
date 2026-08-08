"""Preflight / runtime free-space guards for Layer B writes."""

from __future__ import annotations

import os
from pathlib import Path

from .constants import DEFAULT_MINIMUM_FREE_SPACE_BYTES
from .errors import DiskCapacityError


def free_space_bytes(path: Path) -> int:
    """Return free bytes on the filesystem containing *path*."""
    path = Path(path)
    path.mkdir(parents=True, exist_ok=True)
    st = os.statvfs(path)
    return int(st.f_bavail * st.f_frsize)


def assert_disk_capacity(
    path: Path,
    *,
    estimated_write_bytes: int = 0,
    minimum_free_space_bytes: int = DEFAULT_MINIMUM_FREE_SPACE_BYTES,
    safety_margin_bytes: int = 1024**3,
) -> int:
    """Abort with DiskCapacityError if free space is below required floor.

    Does not delete existing data to free space.
    """
    free = free_space_bytes(path)
    required = max(
        minimum_free_space_bytes,
        int(estimated_write_bytes) + int(safety_margin_bytes),
    )
    if free < required:
        raise DiskCapacityError(
            f"insufficient free space under {path}: free={free} required={required} "
            f"(minimum_free_space_bytes={minimum_free_space_bytes}, "
            f"estimated_write_bytes={estimated_write_bytes})"
        )
    return free
