"""Preflight / runtime free-space guards for Layer B writes."""

from __future__ import annotations

import os
from collections.abc import Callable
from pathlib import Path

from .constants import DEFAULT_MINIMUM_FREE_SPACE_BYTES
from .errors import DiskCapacityError

FreeBytesProvider = Callable[[Path], int]


def free_space_bytes(path: Path) -> int:
    """Return free bytes on the filesystem containing *path* (production probe)."""
    path = Path(path)
    path.mkdir(parents=True, exist_ok=True)
    try:
        st = os.statvfs(path)
    except OSError as exc:
        raise DiskCapacityError(
            f"filesystem probe unavailable under {path}: {exc}"
        ) from exc
    return int(st.f_bavail * st.f_frsize)


# Alias used by injectable call sites / tests.
get_free_bytes = free_space_bytes


def assert_disk_capacity(
    path: Path,
    *,
    estimated_write_bytes: int = 0,
    minimum_free_space_bytes: int = DEFAULT_MINIMUM_FREE_SPACE_BYTES,
    safety_margin_bytes: int = 1024**3,
    free_bytes_provider: FreeBytesProvider | None = None,
) -> int:
    """Abort with DiskCapacityError if free space is below required floor.

    Threshold semantics (frozen): free space must be >= required bytes.
    Equality at the threshold PASSES; free < required FAIL.

    Does not delete existing data to free space.
    Default *free_bytes_provider* is the real filesystem probe.
    """
    provider = free_bytes_provider or free_space_bytes
    try:
        free = int(provider(Path(path)))
    except DiskCapacityError:
        raise
    except OSError as exc:
        raise DiskCapacityError(
            f"filesystem probe unavailable under {path}: {exc}"
        ) from exc
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
