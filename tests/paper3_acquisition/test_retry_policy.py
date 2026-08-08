from __future__ import annotations

import pytest

from src.acquisition.errors import (
    DuplicateWorkIdError,
    FatalAcquisitionError,
    RetryableAcquisitionError,
)
from src.acquisition.retries import is_retryable, run_with_retries


def test_transient_succeeds_on_retry():
    state = {"n": 0}

    def flaky():
        state["n"] += 1
        if state["n"] < 3:
            raise RetryableAcquisitionError("temporary connection reset")
        return "ok"

    assert run_with_retries(flaky, max_retries=5, sleep=lambda _t: None) == "ok"
    assert state["n"] == 3


def test_fatal_never_retries():
    state = {"n": 0}

    def boom():
        state["n"] += 1
        raise DuplicateWorkIdError("duplicate work_id FATAL")

    with pytest.raises(DuplicateWorkIdError):
        run_with_retries(boom, max_retries=5, sleep=lambda _t: None)
    assert state["n"] == 1
    assert is_retryable(FatalAcquisitionError("x")) is False


def test_max_attempts_respected():
    state = {"n": 0}

    def always():
        state["n"] += 1
        raise RetryableAcquisitionError("timeout")

    with pytest.raises(RetryableAcquisitionError):
        run_with_retries(always, max_retries=2, sleep=lambda _t: None)
    assert state["n"] == 3  # initial + 2 retries
