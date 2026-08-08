#!/usr/bin/env bash
# Paper 3 — one-partition WORKS pilot orchestration (SliceSpec v0.2).
# Does NOT start a full WORKS scan.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

IMAGE_TAG="${PAPER3_ACQ_IMAGE_TAG:-paper3-acquisition:0.2.0}"

echo "== build image $IMAGE_TAG =="
docker build -t "$IMAGE_TAG" -f docker/paper3-acquisition/Dockerfile docker/paper3-acquisition

IMAGE_ID="$(docker image inspect "$IMAGE_TAG" --format '{{.Id}}')"
DIGEST="$(docker image inspect "$IMAGE_TAG" --format '{{index .RepoDigests 0}}' 2>/dev/null || true)"
DOCKERFILE_SHA="$(shasum -a 256 docker/paper3-acquisition/Dockerfile | awk '{print $1}')"
REQ_SHA="$(shasum -a 256 docker/paper3-acquisition/requirements.txt | awk '{print $1}')"

export PAPER3_ACQ_IMAGE_TAG="$IMAGE_TAG"
export PAPER3_ACQ_IMAGE_ID="$IMAGE_ID"
export PAPER3_ACQ_IMAGE_DIGEST="${DIGEST:-}"

echo "Dockerfile SHA-256: $DOCKERFILE_SHA"
echo "requirements SHA-256: $REQ_SHA"
echo "Image ID: $IMAGE_ID"
echo "Digest: ${DIGEST:-none}"

run_in_docker() {
  local run_id="$1"
  docker run --rm \
    -e PAPER3_ACQ_IMAGE_TAG \
    -e PAPER3_ACQ_IMAGE_ID \
    -e PAPER3_ACQ_IMAGE_DIGEST \
    -v "$ROOT":/work \
    -w /work/feasibility \
    "$IMAGE_TAG" \
    python -m src.bootstrap_pilot --run-id "$run_id"
}

echo "== run 1 =="
run_in_docker 1

echo "== run 2 (byte-repro) =="
run_in_docker 2

echo "== firewall CI =="
set +e
python3 feasibility/ci/firewall_check.py
FW_RC=$?
set -e

FW_FLAG=()
if [[ "$FW_RC" -eq 0 ]]; then
  FW_FLAG=(--firewall-pass)
fi

echo "== finalize report =="
# finalize inside the same image so pyarrow/pandas stack is available if needed
docker run --rm \
  -v "$ROOT":/work \
  -w /work/feasibility \
  "$IMAGE_TAG" \
  python -m src.finalize_pilot \
    "${FW_FLAG[@]}" \
    --image-tag "$IMAGE_TAG" \
    --image-id "$IMAGE_ID" \
    --image-digest "${DIGEST:-}" \
    --dockerfile-sha256 "$DOCKERFILE_SHA" \
    --requirements-sha256 "$REQ_SHA"

echo "DONE (firewall_rc=$FW_RC)"
exit "$FW_RC"
