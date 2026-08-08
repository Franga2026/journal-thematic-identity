"""Pinned hashes and path anchors for Layer B acquisition."""

from __future__ import annotations

from pathlib import Path

_REPO = Path(__file__).resolve().parents[3]
_FEAS = Path(__file__).resolve().parents[2]

REPO_ROOT = _REPO
FEASIBILITY_ROOT = _FEAS

PROTOCOL_V1_1_SHA256 = (
    "871b75fe47dd45d4a7249681996e178f4cf51acbcb8d345433fdfb729a53fdb8"
)
ACQUISITION_SPEC_V1_0_SHA256 = (
    "e8dd00f702f09cfe256cae439dec76659007cff0e8fac58269d612fc2a22d443"
)
WORKS_MANIFEST_SHA256 = (
    "4b5142cb47f22fb5f6e91fc330ed800e355e8bb9421b10d812394780b9a1443d"
)
PILOT_SLIM_SHA256 = (
    "7d952e5418e76cbced41042c0e3ce645fd63d652aa611d9289b04842abc92f8d"
)

OPENALEX_MANIFEST_DATE = "2026-06-26"
OPENALEX_RELEASE_NOTES_DATE = "2026-06-25"
EXPECTED_WORKS_OBJECTS = 2446
WORKS_TOTAL_CONTENT_LENGTH = 724970323127

YEAR_MIN = 2000
YEAR_MAX = 2026

DOCKER_IMAGE_TAG = "paper3-acquisition:0.2.0"
DOCKER_IMAGE_DIGEST = (
    "sha256:3a7dbe684a28d1ccb4659ffe5138384960eb234ed8d2f1a03580f3b31cf5e76b"
)
DOCKERFILE_SHA256 = (
    "b57a5b659a8b8a3b8fe34a47573adeda373fd806ce1e3c203a5716204658e39d"
)

PINNED_WORKS_MANIFEST = (
    REPO_ROOT / "data" / "paper3" / "bootstrap" / "works_manifest.pinned.json"
)
RAW_MANIFESTS_DIR = REPO_ROOT / "data" / "paper3" / "raw_manifests"
RAW_OBJECT_INVENTORY = RAW_MANIFESTS_DIR / "raw_object_inventory.json"
LAYER_B_ROOT = REPO_ROOT / "data" / "paper3" / "layer_b"
LAYER_B_MANIFESTS = LAYER_B_ROOT / "manifests"
CHECKPOINT_PATH = LAYER_B_MANIFESTS / "acquisition_checkpoint.json"
SHARDS_MANIFEST_PATH = LAYER_B_MANIFESTS / "layer_b_shards_manifest.json"
FULL_ACQUISITION_MANIFEST_PATH = (
    LAYER_B_MANIFESTS / "paper3_full_acquisition_manifest.json"
)
STAGE1_ROOT = LAYER_B_ROOT / "shards" / "stage1"
STAGE2_ROOT = LAYER_B_ROOT / "shards" / "stage2"
TAXONOMY_DIR = REPO_ROOT / "data" / "paper3" / "taxonomy"
CANONICAL_TAXONOMY_PATH = TAXONOMY_DIR / "canonical_topic_taxonomy.json"

SPEC_PATH = (
    REPO_ROOT
    / "docs"
    / "paper3"
    / "Paper3_Full_WORKS_Streaming_Acquisition_Spec_v1.0.md"
)
PROTOCOL_PATH = (
    REPO_ROOT / "docs" / "paper3" / "Paper3_Feasibility_Audit_Protocol_v1.1.md"
)

# Operational default (bytes). Configurable at runtime; not a scientific param.
DEFAULT_MINIMUM_FREE_SPACE_BYTES = 100 * 1024**3  # 100 GiB

MAX_RETRIES = 5
RETRY_BASE_SECONDS = 5.0
RETRY_CAP_SECONDS = 300.0

LEVEL2_OBJECT_INDEXES = (0, 1, 2, 1222, 1223, 2443, 2444, 2445)
