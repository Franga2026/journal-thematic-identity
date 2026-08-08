"""Template / validator for paper3_full_acquisition_manifest.json."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .constants import (
    ACQUISITION_SPEC_V1_0_SHA256,
    DOCKERFILE_SHA256,
    DOCKER_IMAGE_DIGEST,
    EXPECTED_WORKS_OBJECTS,
    FULL_ACQUISITION_MANIFEST_PATH,
    OPENALEX_MANIFEST_DATE,
    OPENALEX_RELEASE_NOTES_DATE,
    PROTOCOL_V1_1_SHA256,
    WORKS_MANIFEST_SHA256,
    WORKS_TOTAL_CONTENT_LENGTH,
    YEAR_MAX,
    YEAR_MIN,
)
from .errors import FatalAcquisitionError
from .object_inventory import canonical_json_bytes
from .slim_schema import SCHEMA_HASH

REQUIRED_KEYS = (
    "project",
    "phase",
    "spec_sha256",
    "protocol_v1_1_sha256",
    "openalex_release_notes_date",
    "openalex_manifest_date",
    "works_manifest_sha256",
    "works_object_count",
    "works_total_content_length",
    "sources_manifest_sha256",
    "taxonomy_hash",
    "docker_image_digest",
    "dockerfile_sha256",
    "extractor_git_commit",
    "extractor_sha256",
    "schema_hash",
    "filter_publication_year_min",
    "filter_publication_year_max",
    "expected_objects",
    "completed_objects",
    "failed_objects",
    "total_input_rows",
    "total_output_rows",
    "total_input_bytes",
    "total_output_bytes",
    "shards_manifest_sha256",
    "contamination_log",
    "prohibited_outcomes_computed",
    "run_started_at",
    "run_completed_at",
)


def pending_full_acquisition_manifest() -> dict[str, Any]:
    """Return a template with pending/null runtime fields (not a fake completed run)."""
    return {
        "project": "paper3",
        "phase": "layer_b_acquisition",
        "spec_sha256": ACQUISITION_SPEC_V1_0_SHA256,
        "protocol_v1_1_sha256": PROTOCOL_V1_1_SHA256,
        "openalex_release_notes_date": OPENALEX_RELEASE_NOTES_DATE,
        "openalex_manifest_date": OPENALEX_MANIFEST_DATE,
        "works_manifest_sha256": WORKS_MANIFEST_SHA256,
        "works_object_count": EXPECTED_WORKS_OBJECTS,
        "works_total_content_length": WORKS_TOTAL_CONTENT_LENGTH,
        "sources_manifest_sha256": None,
        "sources_binding_status": None,
        "taxonomy_hash": None,
        "taxonomy_binding_status": None,
        "storage_readiness_status": None,
        "level2_reproducibility_status": None,
        "docker_image_digest": DOCKER_IMAGE_DIGEST,
        "dockerfile_sha256": DOCKERFILE_SHA256,
        "extractor_git_commit": None,
        "extractor_sha256": None,
        "schema_hash": SCHEMA_HASH,
        "filter_publication_year_min": YEAR_MIN,
        "filter_publication_year_max": YEAR_MAX,
        "expected_objects": EXPECTED_WORKS_OBJECTS,
        "completed_objects": 0,
        "failed_objects": 0,
        "total_input_rows": None,
        "total_output_rows": None,
        "total_input_bytes": None,
        "total_output_bytes": None,
        "shards_manifest_sha256": None,
        "contamination_log": [],
        "prohibited_outcomes_computed": False,
        "run_started_at": None,
        "run_completed_at": None,
        "status": "PENDING_AUTHORIZATION",
        "full_works_scan_started": False,
        "FULL_SCAN_AUTHORIZED": False,
    }


def validate_manifest_shape(manifest: dict[str, Any]) -> None:
    missing = [k for k in REQUIRED_KEYS if k not in manifest]
    if missing:
        raise FatalAcquisitionError(f"manifest missing keys: {missing}")


def write_pending_manifest(
    dest: Path | None = None,
    *,
    updates: dict[str, Any] | None = None,
) -> Path:
    from .sanctioned_io import write_bytes

    path = Path(dest) if dest else FULL_ACQUISITION_MANIFEST_PATH
    payload = pending_full_acquisition_manifest()
    if updates:
        payload.update(updates)
    # Keep production counters honest
    payload["completed_objects"] = 0
    payload["failed_objects"] = 0
    payload["run_started_at"] = None
    payload["run_completed_at"] = None
    payload["full_works_scan_started"] = False
    payload["prohibited_outcomes_computed"] = False
    payload["FULL_SCAN_AUTHORIZED"] = False
    payload["extractor_git_commit"] = None
    validate_manifest_shape(payload)
    write_bytes(path, canonical_json_bytes(payload))
    return path


def load_manifest(path: Path | None = None) -> dict[str, Any]:
    p = Path(path) if path else FULL_ACQUISITION_MANIFEST_PATH
    data = json.loads(p.read_text(encoding="utf-8"))
    validate_manifest_shape(data)
    return data
