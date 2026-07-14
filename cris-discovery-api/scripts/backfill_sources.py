#!/usr/bin/env python3
"""
backfill_sources.py — Asigna sjr_quartile a sources cruzando issns con el mapa Scimago.

Normaliza ISSN: 1042-0533 → 10420533 (el mapa SJR no usa guiones).

Uso (desde cris-discovery-api/):
    python scripts/backfill_sources.py
    CRIS_DB_DSN=... python scripts/backfill_sources.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# cris-discovery-api/ en sys.path para importar db
ROOT_API = Path(__file__).resolve().parent.parent
REPO_ROOT = ROOT_API.parent
sys.path.insert(0, str(ROOT_API))

from db import get_conn  # noqa: E402

SJR_PATH = REPO_ROOT / "scripts" / "data" / "sjr-2025-quartiles.json"
VALID_Q = frozenset({"Q1", "Q2", "Q3", "Q4"})


def norm(issn) -> str:
    """1042-0533 → 10420533 (el mapa SJR no usa guiones)."""
    return re.sub(r"[^0-9X]", "", str(issn).upper())


def quartile_of(value) -> str | None:
    if isinstance(value, str) and value in VALID_Q:
        return value
    if isinstance(value, dict):
        q = value.get("quartile") or value.get("sjr_quartile")
        if isinstance(q, str) and q in VALID_Q:
            return q
    return None


def main() -> int:
    if not SJR_PATH.is_file():
        print(f"✗ No está el mapa SJR: {SJR_PATH}", file=sys.stderr)
        return 1

    sjr = json.loads(SJR_PATH.read_text(encoding="utf-8"))
    sjr_norm = {norm(k): v for k, v in sjr.items() if norm(k)}
    print(f"Mapa SJR: {len(sjr_norm)} claves normalizadas ({SJR_PATH.name})")

    updated = 0
    scanned = 0
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, name, issns
            FROM sources
            WHERE sjr_quartile IS NULL AND issns IS NOT NULL
            """
        ).fetchall()
        scanned = len(rows)

        for row in rows:
            sid = row["id"]
            for issn in row["issns"] or []:
                q = quartile_of(sjr_norm.get(norm(issn)))
                if not q:
                    continue
                conn.execute(
                    """
                    UPDATE sources
                    SET sjr_quartile = %s, sjr_year = 2025
                    WHERE id = %s AND sjr_quartile IS NULL
                    """,
                    (q, sid),
                )
                updated += 1
                break  # el primer ISSN que cruce basta

        conn.commit()

    print(f"✓ Fuentes sin cuartil revisadas: {scanned}")
    print(f"✓ Actualizadas con SJR 2025:     {updated}")

    with get_conn() as conn:
        dist = conn.execute(
            """
            SELECT
              COUNT(*) FILTER (WHERE sjr_quartile IS NOT NULL) AS with_q,
              COUNT(*) FILTER (WHERE sjr_quartile IS NULL) AS without_q,
              COUNT(*) AS total
            FROM sources
            """
        ).fetchone()
        works = conn.execute(
            """
            SELECT
              s.sjr_quartile,
              COUNT(DISTINCT w.id) AS obras
            FROM works w
            LEFT JOIN sources s ON s.id = w.source_id
            GROUP BY s.sjr_quartile
            ORDER BY s.sjr_quartile NULLS LAST
            """
        ).fetchall()

    print(
        f"\nSources: {dist['with_q']} con cuartil / "
        f"{dist['without_q']} sin / {dist['total']} total"
    )
    print("Obras por cuartil:")
    for r in works:
        print(f"  {r['sjr_quartile'] or '(null)':>6}  {r['obras']:>6,}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
