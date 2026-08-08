"""Bind sealed protocol + acquisition spec hashes before any production work."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .constants import (
    ACQUISITION_SPEC_V1_0_SHA256,
    PROTOCOL_PATH,
    PROTOCOL_V1_1_SHA256,
    SPEC_PATH,
    WORKS_MANIFEST_SHA256,
)
from .errors import SpecBindingError
from .object_inventory import load_pinned_object_inventory, sha256_file


def verify_spec_binding(
    *,
    spec_path: Path | None = None,
    protocol_path: Path | None = None,
) -> dict[str, Any]:
    """Fail if sealed markdown bytes do not match expected SHA-256 digests."""
    sp = Path(spec_path) if spec_path else SPEC_PATH
    pp = Path(protocol_path) if protocol_path else PROTOCOL_PATH
    if not sp.is_file():
        raise SpecBindingError(f"acquisition spec missing: {sp}")
    if not pp.is_file():
        raise SpecBindingError(f"protocol missing: {pp}")

    spec_sha = sha256_file(sp)
    proto_sha = sha256_file(pp)
    if spec_sha != ACQUISITION_SPEC_V1_0_SHA256:
        raise SpecBindingError(
            f"acquisition spec SHA mismatch: {spec_sha} != {ACQUISITION_SPEC_V1_0_SHA256}"
        )
    if proto_sha != PROTOCOL_V1_1_SHA256:
        raise SpecBindingError(
            f"protocol SHA mismatch: {proto_sha} != {PROTOCOL_V1_1_SHA256}"
        )

    inv = load_pinned_object_inventory()
    if inv["works_manifest_sha256"] != WORKS_MANIFEST_SHA256:
        raise SpecBindingError("works manifest SHA mismatch inside inventory load")

    return {
        "spec_sha256": spec_sha,
        "protocol_v1_1_sha256": proto_sha,
        "works_manifest_sha256": inv["works_manifest_sha256"],
        "expected_objects": inv["expected_objects"],
        "status": "BOUND",
    }
