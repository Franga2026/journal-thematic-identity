"""Materialize and verify frozen OpenAlex topic taxonomy for Paper 3."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

from .constants import (
    CANONICAL_TAXONOMY_PATH,
    OPENALEX_MANIFEST_DATE,
    OPENALEX_RELEASE_NOTES_DATE,
    REPO_ROOT,
    TAXONOMY_DIR,
)
from .errors import FatalAcquisitionError
from .object_inventory import canonical_json_bytes, sha256_bytes
from .sanctioned_io import write_bytes, write_json
from .taxonomy_binding import (
    TAXONOMY_FIELDS,
    canonicalize_taxonomy_rows,
    write_canonical_topic_taxonomy,
)

STATUS_VERIFIED = "VERIFIED_TAXONOMY_BINDING"
STATUS_UNVERIFIED = "UNVERIFIED_TAXONOMY_BINDING"

RAW_TAXONOMY_ROOT = TAXONOMY_DIR / "raw"
TAXONOMY_MANIFEST_PATH = TAXONOMY_DIR / "taxonomy_manifest.json"
_UPDATED_DATE_RE = re.compile(r"updated_date=(\d{4}-\d{2}-\d{2})")


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _read_parquet_files(entity_dir: Path) -> list[tuple[str, Any, Path]]:
    """Return list of (updated_date_partition, table, path) via ParquetFile."""
    out: list[tuple[str, Any, Path]] = []
    for path in sorted(entity_dir.rglob("*.parquet")):
        m = _UPDATED_DATE_RE.search(str(path))
        part = m.group(1) if m else "0000-00-00"
        table = pq.ParquetFile(path).read()
        out.append((part, table, path))
    return out


def _upsert_topics(entity_dir: Path) -> dict[str, dict[str, Any]]:
    """Merge topic partitions; later updated_date wins for the same topic_id."""
    latest: dict[str, tuple[str, dict[str, Any]]] = {}
    for part, table, _path in _read_parquet_files(entity_dir):
        n = table.num_rows
        for i in range(n):
            tid = table.column("id")[i].as_py()
            if not tid:
                continue
            tid = str(tid)
            name = table.column("display_name")[i].as_py()
            sub = table.column("subfield")[i].as_py() or {}
            field = table.column("field")[i].as_py() or {}
            domain = table.column("domain")[i].as_py() or {}
            row = {
                "topic_id": tid,
                "topic_name": None if name is None else str(name).strip(),
                "subfield_id": None if not sub.get("id") else str(sub["id"]),
                "subfield_name": None
                if not sub.get("display_name")
                else str(sub["display_name"]).strip(),
                "field_id": None if not field.get("id") else str(field["id"]),
                "field_name": None
                if not field.get("display_name")
                else str(field["display_name"]).strip(),
                "domain_id": None if not domain.get("id") else str(domain["id"]),
                "domain_name": None
                if not domain.get("display_name")
                else str(domain["display_name"]).strip(),
            }
            prev = latest.get(tid)
            if prev is None or part >= prev[0]:
                latest[tid] = (part, row)
    return {tid: pair[1] for tid, pair in latest.items()}


def _load_id_set(entity_dir: Path, id_col: str = "id") -> set[str]:
    ids: set[str] = set()
    for _part, table, _path in _read_parquet_files(entity_dir):
        for i in range(table.num_rows):
            v = table.column(id_col)[i].as_py()
            if v:
                ids.add(str(v))
    return ids


def _code_sha256() -> str:
    path = Path(__file__).resolve()
    return _sha256_file(path)


def materialize_canonical_taxonomy(
    *,
    raw_root: Path | None = None,
) -> dict[str, Any]:
    """Build canonical taxonomy + taxonomy_manifest; return binding record."""
    root = Path(raw_root) if raw_root else RAW_TAXONOMY_ROOT
    topics_dir = root / "topics"
    subfields_dir = root / "subfields"
    fields_dir = root / "fields"
    domains_dir = root / "domains"
    for d in (topics_dir, subfields_dir, fields_dir, domains_dir):
        if not d.is_dir():
            raise FatalAcquisitionError(f"taxonomy raw missing: {d}")

    # Confirm release family via entity manifests
    reasons: list[str] = []
    source_meta: dict[str, Any] = {}
    for ent in ("topics", "subfields", "fields", "domains"):
        man_path = root / f"{ent}_manifest.json"
        if not man_path.is_file():
            raise FatalAcquisitionError(f"missing {man_path}")
        man = json.loads(man_path.read_text(encoding="utf-8"))
        if man.get("date") != OPENALEX_MANIFEST_DATE:
            reasons.append(f"{ent}_manifest_date_mismatch:{man.get('date')}")
        source_meta[ent] = {
            "manifest_path": str(man_path.relative_to(REPO_ROOT)),
            "manifest_sha256": _sha256_file(man_path),
            "manifest_date": man.get("date"),
            "record_count": man.get("record_count"),
            "content_length": man.get("content_length"),
            "n_files": len(man.get("files") or []),
        }

    topics_map = _upsert_topics(topics_dir)
    sub_ids = _load_id_set(subfields_dir)
    field_ids = _load_id_set(fields_dir)
    domain_ids = _load_id_set(domains_dir)

    rows = list(topics_map.values())
    canon_rows = canonicalize_taxonomy_rows(rows)

    # Hierarchy consistency
    dup_check = [r["topic_id"] for r in canon_rows]
    if len(dup_check) != len(set(dup_check)):
        reasons.append("duplicate_topic_id_in_canonical")

    missing_sub = sorted(
        {
            r["subfield_id"]
            for r in canon_rows
            if r["subfield_id"] and r["subfield_id"] not in sub_ids
        }
    )
    missing_field = sorted(
        {
            r["field_id"]
            for r in canon_rows
            if r["field_id"] and r["field_id"] not in field_ids
        }
    )
    missing_domain = sorted(
        {
            r["domain_id"]
            for r in canon_rows
            if r["domain_id"] and r["domain_id"] not in domain_ids
        }
    )
    if missing_sub:
        reasons.append(f"missing_subfield_ids:{len(missing_sub)}")
    if missing_field:
        reasons.append(f"missing_field_ids:{len(missing_field)}")
    if missing_domain:
        reasons.append(f"missing_domain_ids:{len(missing_domain)}")

    # Write twice for byte reproducibility check
    path1, sha1 = write_canonical_topic_taxonomy(canon_rows, dest=CANONICAL_TAXONOMY_PATH)
    repro_path = TAXONOMY_DIR / "_canonical_topic_taxonomy.repro.json"
    _repro_written, sha2 = write_canonical_topic_taxonomy(canon_rows, dest=repro_path)
    byte_repro = sha1 == sha2
    if repro_path.exists():
        repro_path.unlink()
        side = repro_path.with_suffix(repro_path.suffix + ".sha256")
        if side.exists():
            side.unlink()

    if not byte_repro:
        reasons.append("canonical_byte_reproducibility_failed")

    expected_topics = source_meta["topics"]["record_count"]
    if expected_topics is not None and len(canon_rows) != int(expected_topics):
        # Upsert may equal record_count; warn if not
        reasons.append(
            f"topic_count:{len(canon_rows)}_vs_manifest:{expected_topics}"
        )

    status = STATUS_VERIFIED if not reasons else STATUS_UNVERIFIED
    if status == STATUS_VERIFIED:
        reasons = [
            "hierarchy_ids_resolve",
            "no_duplicate_topic_ids",
            "canonical_byte_reproducible",
            "release_family_matched",
        ]

    schema_desc = {"fields": list(TAXONOMY_FIELDS), "ordering": "topic_id_asc"}
    schema_sha = sha256_bytes(
        json.dumps(schema_desc, sort_keys=True, separators=(",", ":")).encode("utf-8")
    )

    tax_manifest = {
        "source_release": "openalex_parquet",
        "manifest_date": OPENALEX_MANIFEST_DATE,
        "release_notes_date": OPENALEX_RELEASE_NOTES_DATE,
        "topics_source": source_meta["topics"],
        "subfields_source": source_meta["subfields"],
        "fields_source": source_meta["fields"],
        "domains_source": source_meta["domains"],
        "counts": {
            "topics": len(canon_rows),
            "subfields": len(sub_ids),
            "fields": len(field_ids),
            "domains": len(domain_ids),
        },
        "canonical_path": str(path1.relative_to(REPO_ROOT)),
        "canonical_schema_sha256": schema_sha,
        "canonical_taxonomy_sha256": sha1,
        "canonical_taxonomy_sha256_run2": sha2,
        "byte_reproducible": byte_repro,
        "created_by_code_sha256": _code_sha256(),
        "git_commit": None,
        "binding_status": status,
        "reasons": reasons,
    }
    write_json(TAXONOMY_MANIFEST_PATH, tax_manifest)
    return {
        "status": status,
        "taxonomy_hash": sha1,
        "byte_reproducible": byte_repro,
        "counts": tax_manifest["counts"],
        "reasons": reasons,
        "canonical_path": str(path1),
        "taxonomy_manifest_path": str(TAXONOMY_MANIFEST_PATH),
    }


def verify_taxonomy_binding() -> dict[str, Any]:
    """Re-hash on-disk canonical taxonomy and confirm manifest agreement."""
    if not CANONICAL_TAXONOMY_PATH.is_file() or not TAXONOMY_MANIFEST_PATH.is_file():
        return {"status": STATUS_UNVERIFIED, "reasons": ["artifacts_missing"]}
    man = json.loads(TAXONOMY_MANIFEST_PATH.read_text(encoding="utf-8"))
    body = json.loads(CANONICAL_TAXONOMY_PATH.read_text(encoding="utf-8"))
    # hashed body is topics+version+ordering without external hash field
    digest = sha256_bytes(canonical_json_bytes(body))
    ok = (
        digest == man.get("canonical_taxonomy_sha256")
        and man.get("binding_status") == STATUS_VERIFIED
        and man.get("byte_reproducible") is True
        and man.get("manifest_date") == OPENALEX_MANIFEST_DATE
    )
    return {
        "status": STATUS_VERIFIED if ok else STATUS_UNVERIFIED,
        "taxonomy_hash": digest,
        "manifest_taxonomy_hash": man.get("canonical_taxonomy_sha256"),
        "byte_reproducible": man.get("byte_reproducible"),
        "counts": man.get("counts"),
        "reasons": [] if ok else ["hash_or_status_mismatch"],
    }
