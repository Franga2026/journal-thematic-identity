"""Acquisition checkpoint store with hash-verified resume."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .constants import CHECKPOINT_PATH
from .errors import CheckpointIntegrityError

STATUS_PENDING = "PENDING"
STATUS_RUNNING = "RUNNING"
STATUS_DONE = "DONE"
STATUS_FAILED = "FAILED"
STATUS_VERIFIED = "VERIFIED"

_SKIP_STATUSES = frozenset({STATUS_DONE, STATUS_VERIFIED})


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


class CheckpointStore:
    """JSON map keyed by zero-padded object_index string."""

    def __init__(self, path: Path | None = None) -> None:
        self.path = Path(path) if path else CHECKPOINT_PATH
        self._data: dict[str, Any] = {"version": "1.0", "objects": {}}
        if self.path.is_file():
            self._data = json.loads(self.path.read_text(encoding="utf-8"))

    def _key(self, object_index: int) -> str:
        return f"{int(object_index):04d}"

    def get(self, object_index: int) -> dict[str, Any] | None:
        return self._data.get("objects", {}).get(self._key(object_index))

    def set_status(self, object_index: int, status: str, **fields: Any) -> None:
        key = self._key(object_index)
        entry = dict(self._data.setdefault("objects", {}).get(key) or {})
        entry["object_index"] = int(object_index)
        entry["status"] = status
        entry["last_updated_at"] = _utc_now()
        entry.update(fields)
        self._data["objects"][key] = entry
        self.save()

    def save(self) -> None:
        from .sanctioned_io import write_json

        write_json(self.path, self._data)

    def should_skip(self, object_index: int) -> bool:
        """True only if DONE/VERIFIED and on-disk shards match recorded hashes."""
        entry = self.get(object_index)
        if not entry or entry.get("status") not in _SKIP_STATUSES:
            return False
        shards = entry.get("output_shards") or []
        if not shards:
            raise CheckpointIntegrityError(
                f"object_index={object_index} status={entry.get('status')} "
                "but output_shards missing"
            )
        for shard in shards:
            path = Path(shard["path"])
            if not path.is_file():
                raise CheckpointIntegrityError(
                    f"object_index={object_index}: shard missing: {path}"
                )
            actual = _sha256_file(path)
            expected = shard.get("sha256")
            if actual != expected:
                raise CheckpointIntegrityError(
                    f"object_index={object_index}: shard hash mismatch "
                    f"for {path}: {actual} != {expected}"
                )
            schema_expected = shard.get("schema_sha256")
            if schema_expected and shard.get("schema_sha256_verified_at_write") is False:
                # schema hash is recorded at write; absence of file-level schema
                # re-parse is acceptable if sha256 of bytes matches.
                pass
        return True
