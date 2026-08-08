from __future__ import annotations

from pathlib import Path

import pytest

from src.acquisition.disk_guard import assert_disk_capacity, free_space_bytes
from src.acquisition.errors import DiskCapacityError


def test_disk_guard_normal(tmp_path: Path):
    free = assert_disk_capacity(
        tmp_path,
        estimated_write_bytes=1024,
        minimum_free_space_bytes=1,
        safety_margin_bytes=1,
    )
    assert free == free_space_bytes(tmp_path)
    assert free > 0


def test_disk_below_threshold(tmp_path: Path):
    with pytest.raises(DiskCapacityError, match="insufficient free space"):
        assert_disk_capacity(
            tmp_path,
            estimated_write_bytes=1,
            minimum_free_space_bytes=10**18,
            safety_margin_bytes=0,
        )
