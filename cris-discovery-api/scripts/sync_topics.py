#!/usr/bin/env python3
"""
sync_topics.py — Ancla la taxonomía de topics a los IDs reales de OpenAlex.

PROBLEMA: el loader inicial inventó IDs sintéticos ('T:nombre') porque el JSON
de obras no traía el ID real de OpenAlex para los topics. Resultado: la tabla
`topics` no se puede conectar con OpenAlex — no se puede pedir "las revistas del
subfield X" porque no tenemos el ID real del subfield.

SOLUCIÓN: descargar los ~4.516 topics de OpenAlex (con id, subfield_id, field_id,
domain reales) y:
  1. Poblar una tabla `openalex_topics` completa (la taxonomía maestra).
  2. Reemplazar los stubs de `topics` por los IDs reales, cruzando por nombre.

Esto es cimiento para Discovery Cite (los cuartiles se calculan POR subfield),
y de paso mejora la clasificación temática de todo el portal.

Uso:
    python sync_topics.py --dsn "postgresql://..."
    python sync_topics.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import time

import requests

MAILTO = os.environ.get("OPENALEX_MAILTO", "cris@uta.cl")
API = "https://api.openalex.org/topics"


def fetch_all_topics() -> list[dict]:
    """Descarga los ~4.516 topics paginando (200 por página, cursor)."""
    topics: list[dict] = []
    cursor: str | None = "*"
    page = 0
    session = requests.Session()
    while cursor:
        params = {
            "per-page": 200,
            "cursor": cursor,
            "select": "id,display_name,subfield,field,domain",
            "mailto": MAILTO,
        }
        r = session.get(API, params=params, timeout=60)
        r.raise_for_status()
        data = r.json()
        results = data.get("results", [])
        topics.extend(results)
        cursor = data.get("meta", {}).get("next_cursor")
        page += 1
        print(f"  página {page}: {len(topics)} topics acumulados")
        if not results:
            break
        time.sleep(0.2)  # cortesía con la API
    return topics


def short_id(url: str | None) -> str | None:
    """
    'https://openalex.org/T14423' → 'T14423'
    'https://openalex.org/subfields/2202' → 'subfields/2202'
    'https://openalex.org/fields/22' → 'fields/22'
    """
    if not url:
        return None
    if "/subfields/" in url:
        return "subfields/" + url.rsplit("/", 1)[-1]
    if "/fields/" in url:
        return "fields/" + url.rsplit("/", 1)[-1]
    if "/domains/" in url:
        return "domains/" + url.rsplit("/", 1)[-1]
    return url.rsplit("/", 1)[-1]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--dsn",
        default=os.environ.get(
            "CRIS_DB_DSN",
            "postgresql://postgres:victoria@localhost:5432/cris_victoria",
        ),
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    print("Descargando la taxonomía de topics de OpenAlex...")
    topics = fetch_all_topics()
    print(f"\n  Total descargado: {len(topics)} topics\n")

    if args.dry_run:
        print("=== DRY RUN — ejemplos de lo que se cargaría ===")
        for t in topics[:5]:
            sf = t.get("subfield") or {}
            fld = t.get("field") or {}
            dom = t.get("domain") or {}
            print(f"  {short_id(t['id']):<12} {t['display_name'][:40]:<40}")
            print(
                f"           subfield={short_id(sf.get('id'))} ({sf.get('display_name')})"
            )
            print(
                f"           field={short_id(fld.get('id'))} ({fld.get('display_name')})"
            )
            print(f"           domain={dom.get('display_name')}")
        subfields = {short_id((t.get("subfield") or {}).get("id")) for t in topics}
        fields = {short_id((t.get("field") or {}).get("id")) for t in topics}
        domains = {(t.get("domain") or {}).get("display_name") for t in topics}
        print(
            f"\n  Taxonomía: {len(topics)} topics · {len(subfields - {None})} subfields · "
            f"{len(fields - {None})} fields · {len(domains - {None})} domains"
        )
        return

    import psycopg

    conn = psycopg.connect(args.dsn)
    conn.autocommit = False
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS openalex_topics (
                topic_id      TEXT PRIMARY KEY,     -- T14423
                name          TEXT NOT NULL,
                subfield_id   TEXT,                 -- subfields/2202
                subfield_name TEXT,
                field_id      TEXT,                 -- fields/22
                field_name    TEXT,
                domain_name   TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_oa_topics_subfield ON openalex_topics(subfield_id);
            CREATE INDEX IF NOT EXISTS idx_oa_topics_field ON openalex_topics(field_id);
            CREATE INDEX IF NOT EXISTS idx_oa_topics_name ON openalex_topics(lower(name));
            """
        )

        n = 0
        for t in topics:
            sf = t.get("subfield") or {}
            fld = t.get("field") or {}
            dom = t.get("domain") or {}
            cur.execute(
                """
                INSERT INTO openalex_topics
                    (topic_id, name, subfield_id, subfield_name,
                     field_id, field_name, domain_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (topic_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    subfield_id = EXCLUDED.subfield_id,
                    subfield_name = EXCLUDED.subfield_name,
                    field_id = EXCLUDED.field_id,
                    field_name = EXCLUDED.field_name,
                    domain_name = EXCLUDED.domain_name
                """,
                (
                    short_id(t["id"]),
                    t["display_name"],
                    short_id(sf.get("id")),
                    sf.get("display_name"),
                    short_id(fld.get("id")),
                    fld.get("display_name"),
                    dom.get("display_name"),
                ),
            )
            n += 1
        print(f"✓ openalex_topics: {n} topics cargados")

        # Reparar stubs 'T:nombre' cruzando por nombre (case-insensitive).
        # Si hay varios stubs con el mismo nombre (o colisión a un mismo T-id),
        # anclar solo uno (UNIQUE openalex_id).
        cur.execute("SELECT COUNT(*) FROM topics WHERE openalex_id LIKE 'T:%'")
        stubs = cur.fetchone()[0]
        cur.execute(
            """
            WITH matches AS (
              SELECT
                t.id AS topic_pk,
                ot.topic_id,
                ot.subfield_name,
                ot.field_name,
                ot.domain_name,
                ROW_NUMBER() OVER (
                  PARTITION BY t.id
                  ORDER BY
                    -- Preferir ID libre (sin colisión UNIQUE); luego el id lexicográfico
                    CASE WHEN EXISTS (
                      SELECT 1 FROM topics x WHERE x.openalex_id = ot.topic_id
                    ) THEN 1 ELSE 0 END,
                    ot.topic_id
                ) AS rn
              FROM topics t
              JOIN openalex_topics ot ON lower(t.name) = lower(ot.name)
              WHERE t.openalex_id LIKE 'T:%'
            ),
            chosen AS (
              SELECT * FROM matches
              WHERE rn = 1
                AND NOT EXISTS (
                  SELECT 1 FROM topics x WHERE x.openalex_id = matches.topic_id
                )
            )
            UPDATE topics t
            SET openalex_id = c.topic_id,
                subfield = c.subfield_name,
                field = c.field_name,
                domain = c.domain_name
            FROM chosen c
            WHERE t.id = c.topic_pk
            """
        )
        reparados = cur.rowcount
        print(f"✓ topics reparados: {reparados} de {stubs} stubs")
        if reparados < stubs:
            cur.execute(
                """
                SELECT COUNT(*) FROM topics WHERE openalex_id LIKE 'T:%'
                """
            )
            restantes = cur.fetchone()[0]
            print(
                f"  ⚠ {restantes} stubs quedan sin anclar "
                f"(nombre no encontrado en OpenAlex o colisión UNIQUE)"
            )

    conn.commit()
    print("\n✓ Taxonomía anclada (commit).")

    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(DISTINCT subfield_id) FROM openalex_topics WHERE subfield_id IS NOT NULL"
        )
        print(f"\n  Subfields disponibles: {cur.fetchone()[0]}")
        cur.execute("SELECT COUNT(*) FROM topics WHERE openalex_id NOT LIKE 'T:%'")
        print(f"  Topics del portal ya anclados: {cur.fetchone()[0]}")
        cur.execute(
            """
            SELECT t.subfield, ot.subfield_id, COUNT(DISTINCT t.id) AS n
            FROM topics t
            JOIN openalex_topics ot ON ot.topic_id = t.openalex_id
            WHERE t.subfield IN (
              'Atomic and Molecular Physics, and Optics',
              'Statistical and Nonlinear Physics',
              'Ecology'
            )
            GROUP BY t.subfield, ot.subfield_id
            ORDER BY n DESC
            """
        )
        rows = cur.fetchall()
        if rows:
            print("\n  Verificación subfields de ejemplo:")
            for r in rows:
                print(f"    {r[0]} → {r[1]} ({r[2]} topics portal)")

    conn.close()


if __name__ == "__main__":
    main()
