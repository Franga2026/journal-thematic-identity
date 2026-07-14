#!/usr/bin/env python3
"""
backfill_sources.py — Completa sources con Scimago (cuartil) y Scopus (KBART).

Normaliza ISSN: 1042-0533 → 10420533 (el mapa SJR / KBART no usan guiones).

Uso:
    python cris-discovery-api/scripts/backfill_sources.py --dry-run
    python cris-discovery-api/scripts/backfill_sources.py
    python cris-discovery-api/scripts/backfill_sources.py --kbart ~/Downloads/Elsevier\\ Kbarts/6569_elsevier.scopus_kbart.txt
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from pathlib import Path

ROOT_API = Path(__file__).resolve().parent.parent
REPO_ROOT = ROOT_API.parent
sys.path.insert(0, str(ROOT_API))

from db import get_conn  # noqa: E402

SJR_PATH = REPO_ROOT / "scripts" / "data" / "sjr-2025-quartiles.json"
DEFAULT_KBART = Path(
    os.path.expanduser(
        "~/Downloads/Elsevier Kbarts/6569_elsevier.scopus_kbart.txt"
    )
)
VALID_Q = frozenset({"Q1", "Q2", "Q3", "Q4"})


def norm(issn) -> str | None:
    """1042-0533 → 10420533. Solo ISSN de 8 chars (dígitos/X)."""
    if not issn:
        return None
    s = re.sub(r"[^0-9X]", "", str(issn).upper())
    return s if len(s) == 8 else None


def quartile_of(value) -> str | None:
    if isinstance(value, str) and value in VALID_Q:
        return value
    if isinstance(value, dict):
        q = value.get("quartile") or value.get("sjr_quartile")
        if isinstance(q, str) and q in VALID_Q:
            return q
    return None


def load_sjr_map(path: Path) -> dict[str, str]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for k, v in raw.items():
        nk = norm(k)
        q = quartile_of(v)
        if nk and q:
            out[nk] = q
    return out


def load_kbart_issn_urls(path: Path) -> dict[str, str]:
    """ISSN normalizado → title_url (primera URL no vacía gana)."""
    out: dict[str, str] = {}
    with path.open(encoding="utf-8", errors="replace", newline="") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            url = (row.get("title_url") or "").strip()
            if not url:
                continue
            for col in ("print_identifier", "online_identifier"):
                k = norm(row.get(col))
                if k and k not in out:
                    out[k] = url
    return out


def backfill_scimago(conn, sjr_norm: dict[str, str], dry_run: bool) -> tuple[int, int]:
    rows = conn.execute(
        """
        SELECT id, name, issns
        FROM sources
        WHERE sjr_quartile IS NULL AND issns IS NOT NULL
        """
    ).fetchall()
    would = 0
    for row in rows:
        for issn in row["issns"] or []:
            k = norm(issn)
            q = sjr_norm.get(k) if k else None
            if not q:
                continue
            would += 1
            if not dry_run:
                conn.execute(
                    """
                    UPDATE sources
                    SET sjr_quartile = %s, sjr_year = 2025
                    WHERE id = %s AND sjr_quartile IS NULL
                    """,
                    (q, row["id"]),
                )
            break
    return len(rows), would


def backfill_scopus(
    conn, issn_urls: dict[str, str], dry_run: bool
) -> tuple[int, int]:
    rows = conn.execute(
        """
        SELECT id, name, issns, in_scopus, scopus_url
        FROM sources
        WHERE issns IS NOT NULL
        """
    ).fetchall()
    would = 0
    for row in rows:
        url = None
        for issn in row["issns"] or []:
            k = norm(issn)
            if k and k in issn_urls:
                url = issn_urls[k]
                break
        if not url:
            continue
        if row["in_scopus"] and row.get("scopus_url") == url:
            continue
        would += 1
        if not dry_run:
            conn.execute(
                """
                UPDATE sources
                SET in_scopus = true, scopus_url = %s
                WHERE id = %s
                """,
                (url, row["id"]),
            )
    return len(rows), would


def print_stats(conn) -> None:
    dist = conn.execute(
        """
        SELECT
          COUNT(*) FILTER (WHERE sjr_quartile IS NOT NULL) AS with_q,
          COUNT(*) FILTER (WHERE sjr_quartile IS NULL) AS without_q,
          COUNT(*) FILTER (WHERE in_scopus) AS in_scopus,
          COUNT(*) AS total
        FROM sources
        """
    ).fetchone()
    works = conn.execute(
        """
        SELECT
          COUNT(*) FILTER (WHERE s.in_scopus) AS obras_scopus,
          COUNT(*) FILTER (WHERE s.sjr_quartile IS NULL) AS obras_sin_q
        FROM works w
        LEFT JOIN sources s ON s.id = w.source_id
        """
    ).fetchone()
    print(
        f"\nSources: {dist['with_q']} con cuartil / {dist['without_q']} sin / "
        f"{dist['in_scopus']} in_scopus / {dist['total']} total"
    )
    print(
        f"Obras:   {works['obras_scopus']:,} en Scopus / "
        f"{works['obras_sin_q']:,} sin cuartil"
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo cuenta cruces; no escribe en la BD",
    )
    ap.add_argument(
        "--kbart",
        type=Path,
        default=DEFAULT_KBART,
        help=f"KBART Scopus (default: {DEFAULT_KBART})",
    )
    ap.add_argument(
        "--skip-scimago",
        action="store_true",
        help="No cruzar mapa SJR",
    )
    ap.add_argument(
        "--skip-scopus",
        action="store_true",
        help="No cruzar KBART Scopus",
    )
    args = ap.parse_args()
    dry = args.dry_run

    if dry:
        print("=== DRY-RUN (no se escribe en la BD) ===\n")

    if not args.skip_scimago:
        if not SJR_PATH.is_file():
            print(f"✗ No está el mapa SJR: {SJR_PATH}", file=sys.stderr)
            return 1
        sjr_norm = load_sjr_map(SJR_PATH)
        print(f"Mapa SJR: {len(sjr_norm)} claves ({SJR_PATH.name})")
    else:
        sjr_norm = {}

    if not args.skip_scopus:
        if not args.kbart.is_file():
            print(f"✗ No está el KBART: {args.kbart}", file=sys.stderr)
            return 1
        issn_urls = load_kbart_issn_urls(args.kbart)
        print(f"KBART:    {len(issn_urls)} ISSN→URL ({args.kbart.name})")
    else:
        issn_urls = {}

    with get_conn() as conn:
        if not args.skip_scimago:
            scanned, would = backfill_scimago(conn, sjr_norm, dry)
            label = "actualizaría" if dry else "actualizadas"
            print(f"Scimago:  {scanned} sin cuartil revisadas → {would} {label}")

        if not args.skip_scopus:
            scanned, would = backfill_scopus(conn, issn_urls, dry)
            label = "marcaría" if dry else "marcadas"
            print(f"Scopus:   {scanned} fuentes con ISSN → {would} {label} in_scopus")

        if not dry:
            conn.commit()
            print("✓ commit")
        else:
            conn.rollback()

        print_stats(conn)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
