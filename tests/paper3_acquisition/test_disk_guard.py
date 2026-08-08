"""Deterministic disk-guard unit tests (injected free-space provider)."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.acquisition.disk_guard import (
    assert_disk_capacity,
    free_space_bytes,
    get_free_bytes,
)
from src.acquisition.errors import DiskCapacityError


def _const(n: int):
    def _provider(_path: Path) -> int:
        return n

    return _provider


def test_disk_guard_free_above_threshold():
    free = assert_disk_capacity(
        Path("/unused"),
        estimated_write_bytes=0,
        minimum_free_space_bytes=1000,
        safety_margin_bytes=0,
        free_bytes_provider=_const(1001),
    )
    assert free == 1001


def test_disk_guard_free_equals_threshold_passes():
    """Frozen semantics: free >= required PASSES (equality allowed)."""
    free = assert_disk_capacity(
        Path("/unused"),
        estimated_write_bytes=0,
        minimum_free_space_bytes=1000,
        safety_margin_bytes=0,
        free_bytes_provider=_const(1000),
    )
    assert free == 1000


def test_disk_guard_free_just_below_threshold_fails():
    with pytest.raises(DiskCapacityError, match="insufficient free space"):
        assert_disk_capacity(
            Path("/unused"),
            estimated_write_bytes=0,
            minimum_free_space_bytes=1000,
            safety_margin_bytes=0,
            free_bytes_provider=_const(999),
        )


def test_disk_guard_probe_oserror_controlled_fail():
    def boom(_path: Path) -> int:
        raise OSError("statvfs failed")

    with pytest.raises(DiskCapacityError, match="filesystem probe unavailable"):
        assert_disk_capacity(
            Path("/unused"),
            estimated_write_bytes=0,
            minimum_free_space_bytes=1,
            safety_margin_bytes=0,
            free_bytes_provider=boom,
        )


def test_disk_guard_default_provider_is_real_filesystem(tmp_path: Path):
    """Production default still measures the real filesystem."""
    assert get_free_bytes is free_space_bytes
    free = assert_disk_capacity(
        tmp_path,
        estimated_write_bytes=0,
        minimum_free_space_bytes=1,
        safety_margin_bytes=0,
    )
    assert free > 0
    # Do not re-probe for equality (live f_bavail can race); return is int from real probe.
    assert isinstance(free, int)


def test_disk_below_threshold_via_required_floor(tmp_path: Path):
    """Keep prior high-threshold failure case (uses real provider)."""
    with pytest.raises(DiskCapacityError, match="insufficient free space"):
        assert_disk_capacity(
            tmp_path,
            estimated_write_bytes=1,
            minimum_free_space_bytes=10**18,
            safety_margin_bytes=0,
        )
