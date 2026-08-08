"""Acquisition-specific exceptions (outcome-blind)."""

from __future__ import annotations


class AcquisitionError(RuntimeError):
    """Base class for Layer B acquisition failures."""


class ManifestMismatchError(AcquisitionError):
    """Pinned manifest hash/count/order does not match sealed expectations."""


class DuplicateWorkIdError(AcquisitionError):
    """Duplicate work_id detected; policy is FATAL (no silent keep/drop)."""


class DiskCapacityError(AcquisitionError):
    """Insufficient free space for the planned write."""


class CheckpointIntegrityError(AcquisitionError):
    """Checkpoint claims DONE/VERIFIED but on-disk shard fails verification."""


class SchemaMismatchError(AcquisitionError):
    """Table schema is incompatible with the locked slim schema."""


class FatalAcquisitionError(AcquisitionError):
    """Non-retryable failure; caller must STOP."""


class RetryableAcquisitionError(AcquisitionError):
    """Transient failure eligible for bounded retry."""


class SpecBindingError(AcquisitionError):
    """Sealed spec / protocol hash binding failed."""


class SourceBindingError(AcquisitionError):
    """SOURCES release cannot be proven compatible with pinned WORKS."""


class ContaminationEvent(AcquisitionError):
    """Prohibited outcome-bearing material was attempted during acquisition."""
