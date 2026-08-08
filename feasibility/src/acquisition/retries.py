"""Bounded retry with exponential backoff for transient acquisition errors."""

from __future__ import annotations

import time
from typing import Callable, TypeVar

from .constants import MAX_RETRIES, RETRY_BASE_SECONDS, RETRY_CAP_SECONDS
from .errors import (
    CheckpointIntegrityError,
    ContaminationEvent,
    DiskCapacityError,
    DuplicateWorkIdError,
    FatalAcquisitionError,
    ManifestMismatchError,
    RetryableAcquisitionError,
    SchemaMismatchError,
    SpecBindingError,
)

T = TypeVar("T")

_FATAL_TYPES = (
    ManifestMismatchError,
    DuplicateWorkIdError,
    DiskCapacityError,
    SchemaMismatchError,
    CheckpointIntegrityError,
    SpecBindingError,
    ContaminationEvent,
    FatalAcquisitionError,
)


def is_retryable(exc: BaseException) -> bool:
    """Return True only for explicitly retryable error classes."""
    if isinstance(exc, _FATAL_TYPES):
        return False
    return isinstance(exc, RetryableAcquisitionError)


def backoff_seconds(attempt: int, object_index: int = 0) -> float:
    """Exponential backoff with deterministic jitter from object_index."""
    # attempt is 0-based failure count before next try
    raw = RETRY_BASE_SECONDS * (2**attempt)
    capped = min(raw, RETRY_CAP_SECONDS)
    jitter = (object_index % 7) * 0.01
    return capped + jitter


def run_with_retries(
    fn: Callable[[], T],
    *,
    max_retries: int = MAX_RETRIES,
    object_index: int = 0,
    sleep: Callable[[float], None] | None = None,
) -> T:
    """Execute *fn* with up to *max_retries* retries on RetryableAcquisitionError.

    Fatal errors are re-raised immediately. After exhausting retries, the last
    retryable error is raised.
    """
    sleeper = sleep or time.sleep
    last: BaseException | None = None
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001
            if not is_retryable(exc):
                raise
            last = exc
            if attempt >= max_retries:
                break
            sleeper(backoff_seconds(attempt, object_index=object_index))
    assert last is not None
    raise last
