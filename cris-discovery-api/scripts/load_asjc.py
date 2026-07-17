#!/usr/bin/env python3
"""
load_asjc.py — Carga la taxonomia ASJC de Scopus y la mapea con OpenAlex.

Opcion A: Discovery Cite se CALCULA con OpenAlex (abierto, gratis) pero se
PRESENTA con la estructura ASJC de Scopus (cluster -> area -> subarea), que es
la que los investigadores reconocen.

Los subfields de OpenAlex usan los mismos codigos que ASJC (OpenAlex derivo su
taxonomia del ASJC), asi que el mapeo es 1:1 por codigo.

Crea:
  - asjc_categories: el arbol (334 subareas, 27 areas, 4 clusters)
  - Vincula openalex_topics.subfield_id con el codigo ASJC
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Permitir `from asjc_tree import …` al ejecutar desde cualquier cwd
sys.path.insert(0, str(Path(__file__).resolve().parent))

from asjc_tree import ASJC, CLUSTERS

DSN = os.environ.get(
    "CRIS_DB_DSN",
    "postgresql://postgres:victoria@localhost:5432/cris_victoria",
)

# Invertir CLUSTERS: {codigo_area: nombre_cluster}
AREA_TO_CLUSTER: dict[str, str] = {}
for cluster, areas in CLUSTERS.items():
    for a in areas:
        AREA_TO_CLUSTER[a] = cluster


def main() -> None:
    import psycopg

    conn = psycopg.connect(DSN)
    with conn.cursor() as cur:
        cur.execute(
            """
            DROP TABLE IF EXISTS asjc_categories CASCADE;
            CREATE TABLE asjc_categories (
                code         TEXT PRIMARY KEY,   -- '3109' (subarea) o '31' (area)
                name         TEXT NOT NULL,
                level        TEXT NOT NULL,       -- 'area' | 'subfield'
                parent_code  TEXT,                -- subarea -> su area
                cluster      TEXT,                -- el gran grupo tematico
                -- El subfield de OpenAlex equivalente (mismo codigo)
                openalex_subfield_id TEXT          -- 'subfields/3109'
            );
            CREATE INDEX idx_asjc_parent ON asjc_categories(parent_code);
            CREATE INDEX idx_asjc_cluster ON asjc_categories(cluster);
            CREATE INDEX idx_asjc_oa ON asjc_categories(openalex_subfield_id);
            """
        )
        n_area = n_sub = 0
        for area_code, (area_name, subs) in ASJC.items():
            cluster = AREA_TO_CLUSTER.get(area_code)
            # El area (nivel 2 digitos)
            cur.execute(
                """
                INSERT INTO asjc_categories (code, name, level, parent_code, cluster)
                VALUES (%s, %s, 'area', NULL, %s)
                """,
                (area_code, area_name, cluster),
            )
            n_area += 1
            # Las subareas (4 digitos) — mapean a subfields de OpenAlex
            for sub_code, sub_name in subs:
                cur.execute(
                    """
                    INSERT INTO asjc_categories
                        (code, name, level, parent_code, cluster, openalex_subfield_id)
                    VALUES (%s, %s, 'subfield', %s, %s, %s)
                    """,
                    (
                        sub_code,
                        sub_name,
                        area_code,
                        cluster,
                        f"subfields/{sub_code}",
                    ),
                )
                n_sub += 1
    conn.commit()
    print(
        f"✓ asjc_categories: {n_area} areas, {n_sub} subareas, "
        f"{len(CLUSTERS)} clusters"
    )

    # Verificacion: ¿cuantos subfields de OpenAlex mapean con ASJC?
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(DISTINCT ot.subfield_id)
            FROM openalex_topics ot
            WHERE ot.subfield_id IS NOT NULL
            """
        )
        oa_total = cur.fetchone()[0]
        cur.execute(
            """
            SELECT COUNT(DISTINCT ot.subfield_id)
            FROM openalex_topics ot
            JOIN asjc_categories a ON a.openalex_subfield_id = ot.subfield_id
            """
        )
        mapeados = cur.fetchone()[0]
        print(f"\n  Subfields OpenAlex: {oa_total}")
        print(
            f"  Mapeados con ASJC:  {mapeados}  "
            f"({100 * mapeados // oa_total if oa_total else 0}%)"
        )

        # Los que NO mapean (subfields de OpenAlex sin equivalente ASJC)
        cur.execute(
            """
            SELECT DISTINCT ot.subfield_id, ot.subfield_name
            FROM openalex_topics ot
            LEFT JOIN asjc_categories a
              ON a.openalex_subfield_id = ot.subfield_id
            WHERE a.code IS NULL AND ot.subfield_id IS NOT NULL
            LIMIT 10
            """
        )
        sin = cur.fetchall()
        if sin:
            print(f"\n  Subfields OpenAlex SIN equivalente ASJC ({len(sin)} muestra):")
            for sid, name in sin:
                print(f"    {sid}  {name}")

        # Discovery Cite ya calculado, ahora con su rama ASJC
        cur.execute(
            """
            SELECT a.cluster, a.name AS area, sub.name AS subarea,
                   COUNT(DISTINCT m.source_id) AS revistas
            FROM discovery_cite_metrics m
            JOIN asjc_categories sub ON sub.openalex_subfield_id = m.subfield_id
            JOIN asjc_categories a ON a.code = sub.parent_code
            GROUP BY a.cluster, a.name, sub.name
            ORDER BY revistas DESC
            """
        )
        rows = cur.fetchall()
        if rows:
            print("\n  Discovery Cite ya calculado, ubicado en el arbol ASJC:")
            for cluster, area, subarea, n in rows:
                print(f"    [{cluster}] {area} > {subarea}: {n} revistas")
    conn.close()


if __name__ == "__main__":
    main()
