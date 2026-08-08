from __future__ import annotations

from pathlib import Path

import pytest

from src.acquisition.errors import SpecBindingError
from src.acquisition.input_binding import verify_spec_binding


def test_valid_spec_binding():
    binding = verify_spec_binding()
    assert binding["status"] == "BOUND"
    assert binding["expected_objects"] == 2446


def test_spec_binding_fails_on_tampered_file(tmp_path: Path):
    fake = tmp_path / "fake_spec.md"
    fake.write_text("not the sealed spec\n", encoding="utf-8")
    with pytest.raises(SpecBindingError, match="acquisition spec SHA mismatch"):
        verify_spec_binding(spec_path=fake)
