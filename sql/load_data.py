#!/usr/bin/env python3
"""
load_data.py — Migra los JSON de CRIS Victoria a PostgreSQL.

Lee:
  src/data.json        → 367 investigadores (id/RUT, nombre, ORCID, unidad)
  src/all-works.json   → obras con vínculo institucional (W-id o autores_uta)
  src/openalex.json    → métricas por ORCID (h_index, works_count, ...)

IMPORTANTE: lee all-works.json, NO works-lite.json. El lite quitó authorships,
que es justo lo que más nos interesa normalizar (es lo que desbloquea el
Observatorio de colaboración).

Idempotente: se puede correr varias veces sin duplicar (ON CONFLICT).

Uso:
    pip install 'psycopg[binary]'
    python sql/load_data.py --data-dir "/Users/franga/Downloads/directorio-uta 7/src"
"""

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    sys.exit("Falta psycopg. Instala:  pip install 'psycopg[binary]'")


# --- Configuración de la institución (la UTA) --------------------------------
INSTITUTION = {
    "slug": "uta",
    "name": "Universidad de Tarapacá",
    "short_name": "UTA",
    "country_code": "CL",
    "ror": "04xe01d27",
    "openalex_id": "I185652977",
}

# Nombres OpenAlex → número ODS (casefold para variantes tipográficas)
SDG_NAME_TO_NUMBER = {
    "no poverty": 1,
    "zero hunger": 2,
    "good health and well-being": 3,
    "quality education": 4,
    "gender equality": 5,
    "clean water and sanitation": 6,
    "affordable and clean energy": 7,
    "decent work and economic growth": 8,
    "industry, innovation and infrastructure": 9,
    "reduced inequalities": 10,
    "sustainable cities and communities": 11,
    "responsible consumption and production": 12,
    "climate action": 13,
    "life below water": 14,
    "life on land": 15,
    "peace, justice, and strong institutions": 16,
    "partnerships for the goals": 17,
}


def clean_orcid(value):
    """Normaliza un ORCID a 0000-0000-0000-0000. None si no es válido."""
    if not value:
        return None
    s = str(value).strip()
    for prefix in ("https://orcid.org/", "http://orcid.org/", "orcid.org/"):
        if s.lower().startswith(prefix):
            s = s[len(prefix) :]
    s = s.strip()
    return s if len(s) == 19 and s.count("-") == 3 else None


def clean_openalex_id(value):
    if not value:
        return None
    s = str(value).strip()
    s = re.sub(r"^https?://openalex\.org/", "", s, flags=re.I)
    return s or None


def short_dept(name):
    """'Departamento de Matemática' → 'Matemática'"""
    if not name:
        return None
    for prefix in ("Departamento de ", "Escuela de ", "Instituto de ", "Centro de "):
        if name.startswith(prefix):
            return name[len(prefix) :]
    return name


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def normalize_list(raw):
    """Los JSON pueden ser un array o {clave: array}. Devuelve siempre el array."""
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        for v in raw.values():
            if isinstance(v, list):
                return v
    return []


def normalize_quartile(qi):
    if not qi:
        return None
    m = re.match(r"^Q?([1-4])$", str(qi).strip().upper())
    return f"Q{m.group(1)}" if m else None


def extract_percentile(value):
    """OpenAlex percentile puede ser número o {value, is_in_top_*}."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, dict) and value.get("value") is not None:
        try:
            return float(value["value"])
        except (TypeError, ValueError):
            return None
    return None


def work_stable_id(w, index):
    """openalex_id si existe; si no, clave estable (doi: o local:hash)."""
    oa = clean_openalex_id(w.get("openalex_id") or w.get("id"))
    if oa:
        return oa
    doi = (w.get("d") or "").strip()
    if doi:
        return f"doi:{doi}"
    blob = f"{w.get('t')}|{w.get('y')}|{w.get('s')}|{index}".encode()
    return f"local:{hashlib.sha1(blob).hexdigest()[:16]}"


def dedupe_works(arr):
    """
    1) Criterio de pertenencia: sin openalex_id/id NI autores_uta → fuera
       (huérfanas del harvest, sin evidencia UTA).
    2) Una fila por openalex_id (ON CONFLICT unifica; aquí evitamos reinsertar).
    → ~8.607 obras
    """
    vistos = set()
    limpio = []
    n_dupes = 0
    n_orphans = 0
    for o in arr:
        oa_id = o.get("openalex_id") or o.get("id")
        tiene_autores_uta = bool(o.get("autores_uta"))
        # Sin evidencia de vínculo con la institución → no entra.
        if not oa_id and not tiene_autores_uta:
            n_orphans += 1
            continue
        if oa_id:
            key = clean_openalex_id(oa_id) or str(oa_id)
            if key in vistos:
                n_dupes += 1
                continue
            vistos.add(key)
        limpio.append(o)
    return limpio, n_dupes, n_orphans


def resolve_sdg(sdg):
    """Devuelve (sdg_id, sdg_name) o None."""
    if isinstance(sdg, dict):
        sid, sname = sdg.get("id"), sdg.get("name")
        if sid is not None:
            try:
                n = int(str(sid).split("/")[-1])
                if 1 <= n <= 17:
                    return n, sname
            except (ValueError, TypeError):
                pass
        if sname:
            n = SDG_NAME_TO_NUMBER.get(str(sname).casefold())
            if n:
                return n, sname
        return None
    if isinstance(sdg, int):
        return (sdg, None) if 1 <= sdg <= 17 else None
    if isinstance(sdg, str):
        n = SDG_NAME_TO_NUMBER.get(sdg.casefold())
        if n:
            return n, sdg
        try:
            n = int(sdg.split("/")[-1])
            if 1 <= n <= 17:
                return n, None
        except (ValueError, TypeError):
            return None
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", required=True, help="Carpeta con los JSON (src/)")
    ap.add_argument(
        "--dsn",
        default=os.environ.get(
            "CRIS_DB_DSN",
            "postgresql://postgres:victoria@localhost:5432/cris_victoria",
        ),
    )
    args = ap.parse_args()

    d = Path(args.data_dir)
    print(f"Leyendo JSON de {d}\n")

    researchers_raw = normalize_list(load_json(d / "data.json"))
    works_raw, n_dupes, n_orphans = dedupe_works(
        normalize_list(load_json(d / "all-works.json"))
    )
    oa_raw = load_json(d / "openalex.json")
    oa_authors = oa_raw.get("authors", {}) if isinstance(oa_raw, dict) else {}

    print(f"  {len(researchers_raw)} investigadores")
    print(
        f"  {len(works_raw)} obras "
        f"(-{n_dupes} W-id dup; -{n_orphans} huérfanas sin vínculo UTA)"
    )
    print(f"  {len(oa_authors)} perfiles OpenAlex\n")

    conn = psycopg.connect(args.dsn, row_factory=dict_row)
    conn.autocommit = False

    with conn.cursor() as cur:
        # =====================================================================
        # 1. INSTITUCIÓN
        # =====================================================================
        cur.execute(
            """
            INSERT INTO institutions (slug, name, short_name, country_code, ror, openalex_id)
            VALUES (%(slug)s, %(name)s, %(short_name)s, %(country_code)s, %(ror)s, %(openalex_id)s)
            ON CONFLICT (slug) DO UPDATE SET
                name = EXCLUDED.name,
                updated_at = now()
            RETURNING id
        """,
            INSTITUTION,
        )
        inst_id = cur.fetchone()["id"]
        print(f"✓ Institución: {INSTITUTION['name']} (id={inst_id})")

        # =====================================================================
        # 2. UNIDADES (de dp[].d)
        # =====================================================================
        unit_names = set()
        for r in researchers_raw:
            for dp in r.get("dp") or []:
                if dp.get("d"):
                    unit_names.add(dp["d"])

        unit_ids = {}
        for name in sorted(unit_names):
            cur.execute(
                """
                INSERT INTO units (institution_id, name, short_name)
                VALUES (%s, %s, %s)
                ON CONFLICT (institution_id, name) DO UPDATE SET
                    short_name = EXCLUDED.short_name
                RETURNING id
            """,
                (inst_id, name, short_dept(name)),
            )
            unit_ids[name] = cur.fetchone()["id"]
        print(f"✓ Unidades: {len(unit_ids)}")

        # =====================================================================
        # 3. INVESTIGADORES (+ métricas de OpenAlex por ORCID)
        # =====================================================================
        researcher_ids = {}
        by_orcid = {}
        con_orcid = 0
        con_metricas = 0

        for r in researchers_raw:
            local_id = str(r.get("id") or "").strip()
            if not local_id:
                continue

            orcid = clean_orcid(r.get("o"))
            if orcid:
                con_orcid += 1

            oa = oa_authors.get(orcid) if orcid else None
            if oa:
                con_metricas += 1

            oa_id = clean_openalex_id(oa.get("openalex_id")) if oa else None

            # Honestidad del dato: sin perfil OpenAlex → NULL (nunca 0 inventado).
            # Si OpenAlex reporta 0, se conserva (h-index real cero ≠ sin datos).
            h_index = oa.get("h_index") if oa else None
            works_count = oa.get("works_count") if oa else None
            cited_by_count = oa.get("cited_by_count") if oa else None
            mean_citedness = oa.get("fwci") if oa else None

            cur.execute(
                """
                INSERT INTO researchers (
                    institution_id, local_id, first_name, last_name, email, phone,
                    position, gender, orcid, openalex_ids,
                    h_index, works_count, cited_by_count, mean_citedness,
                    metrics_synced_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    CASE WHEN %s THEN now() ELSE NULL END
                )
                ON CONFLICT (institution_id, local_id) DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    orcid = EXCLUDED.orcid,
                    openalex_ids = EXCLUDED.openalex_ids,
                    h_index = EXCLUDED.h_index,
                    works_count = EXCLUDED.works_count,
                    cited_by_count = EXCLUDED.cited_by_count,
                    mean_citedness = EXCLUDED.mean_citedness,
                    metrics_synced_at = EXCLUDED.metrics_synced_at,
                    updated_at = now()
                RETURNING id
            """,
                (
                    inst_id,
                    local_id,
                    r.get("f"),
                    r.get("l"),
                    r.get("e"),
                    r.get("ph"),
                    r.get("t"),
                    r.get("g"),
                    orcid,
                    [oa_id] if oa_id else None,
                    h_index,
                    works_count,
                    cited_by_count,
                    mean_citedness,
                    bool(oa),
                ),
            )
            rid = cur.fetchone()["id"]
            researcher_ids[local_id] = rid
            if orcid:
                by_orcid[orcid] = rid

            for i, dp in enumerate(r.get("dp") or []):
                uname = dp.get("d")
                if uname and uname in unit_ids:
                    cur.execute(
                        """
                        INSERT INTO researcher_units (researcher_id, unit_id, role, is_primary)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (researcher_id, unit_id) DO UPDATE SET
                            role = EXCLUDED.role
                    """,
                        (rid, unit_ids[uname], dp.get("j"), i == 0),
                    )

        print(f"✓ Investigadores: {len(researcher_ids)}")
        print(f"    con ORCID:            {con_orcid}")
        print(f"    con métricas OpenAlex: {con_metricas}")
        print(f"    sin datos (honesto):   {len(researcher_ids) - con_metricas}")

        # =====================================================================
        # 4. TEMAS Y FUENTES (de las obras)
        # =====================================================================
        topic_ids = {}
        source_ids = {}

        def get_topic_id(w):
            name = w.get("topic")
            if not name:
                return None
            if name in topic_ids:
                return topic_ids[name]
            cur.execute(
                """
                INSERT INTO topics (openalex_id, name, subfield, field, domain)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (openalex_id) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
            """,
                (f"T:{name}", name, w.get("subfield"), w.get("field"), None),
            )
            topic_ids[name] = cur.fetchone()["id"]
            return topic_ids[name]

        def get_source_id(w):
            name = w.get("s")
            if not name:
                return None
            if name in source_ids:
                return source_ids[name]

            issns = set()
            cr = w.get("cr_issn")
            if isinstance(cr, list):
                issns.update(str(i).strip() for i in cr if i)
            elif isinstance(cr, str):
                issns.update(i.strip() for i in cr.split(",") if i.strip())
            up = w.get("up_issn")
            if isinstance(up, str):
                issns.update(i.strip() for i in up.split(",") if i.strip())

            # qi = cuartil (Q1…Q4); qc es color CSS — no usarlo aquí
            quartile = normalize_quartile(w.get("qi"))

            cur.execute(
                """
                INSERT INTO sources (openalex_id, name, publisher, issns, sjr_quartile, is_oa)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (openalex_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    issns = EXCLUDED.issns,
                    sjr_quartile = COALESCE(EXCLUDED.sjr_quartile, sources.sjr_quartile)
                RETURNING id
            """,
                (
                    f"S:{name}",
                    name,
                    w.get("pub") or w.get("up_publisher"),
                    list(issns) if issns else None,
                    quartile,
                    w.get("srcOA"),
                ),
            )
            source_ids[name] = cur.fetchone()["id"]
            return source_ids[name]

        # =====================================================================
        # 5. OBRAS + AUTORÍAS
        # =====================================================================
        n_works = 0
        n_auth = 0
        n_auth_uta = 0
        n_without_oa = 0
        n_descartadas = 0

        for idx, w in enumerate(works_raw):
            oa_raw_id = w.get("openalex_id") or w.get("id")
            tiene_autores_uta = bool(w.get("autores_uta"))
            # Red de seguridad (dedupe_works ya filtró, pero el criterio queda aquí).
            if not oa_raw_id and not tiene_autores_uta:
                n_descartadas += 1
                continue

            oa_id = work_stable_id(w, idx)
            if oa_id.startswith("local:") or oa_id.startswith("doi:"):
                n_without_oa += 1

            source_id = get_source_id(w)
            topic_id = get_topic_id(w)

            raw_extra = {
                k: v
                for k, v in w.items()
                if k.startswith(("cr_", "up_")) and v is not None
            }

            oa_status = w.get("up_oa_status") or (
                w.get("ou") if w.get("ou") in ("gold", "green", "hybrid", "bronze", "closed") else None
            )

            cur.execute(
                """
                INSERT INTO works (
                    institution_id, openalex_id, doi, title, publication_year,
                    type, source_id, cited_by_count, fwci, percentile,
                    is_oa, oa_status, primary_topic_id, raw
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s
                )
                ON CONFLICT (institution_id, openalex_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    cited_by_count = EXCLUDED.cited_by_count,
                    fwci = EXCLUDED.fwci,
                    oa_status = EXCLUDED.oa_status,
                    updated_at = now()
                RETURNING id
            """,
                (
                    inst_id,
                    oa_id,
                    w.get("d"),
                    w.get("t") or "(sin título)",
                    w.get("y"),
                    w.get("tp"),
                    source_id,
                    w.get("c") if w.get("c") is not None else w.get("cited_by_count"),
                    w.get("fwci"),
                    extract_percentile(w.get("percentile")),
                    w.get("oa"),
                    oa_status,
                    topic_id,
                    json.dumps(raw_extra) if raw_extra else None,
                ),
            )
            work_id = cur.fetchone()["id"]
            n_works += 1

            cur.execute("DELETE FROM authorships WHERE work_id = %s", (work_id,))

            uta_by_index = {}
            for au in w.get("autores_uta") or []:
                if not isinstance(au, dict):
                    continue
                aidx = au.get("author_index")
                rut = str(au.get("rut") or "").strip()
                if aidx is not None and rut in researcher_ids:
                    uta_by_index[aidx] = researcher_ids[rut]

            for pos, a in enumerate(w.get("authorships") or []):
                if not isinstance(a, dict):
                    continue
                author = a.get("author") or {}
                if not isinstance(author, dict):
                    author = {}
                insts = a.get("institutions") or []
                first_inst = insts[0] if insts else {}
                if not isinstance(first_inst, dict):
                    first_inst = {}

                rid = uta_by_index.get(pos)
                is_internal = rid is not None
                if is_internal:
                    n_auth_uta += 1

                cur.execute(
                    """
                    INSERT INTO authorships (
                        work_id, researcher_id, author_openalex_id, author_name,
                        author_orcid, author_position, is_corresponding,
                        institution_name, institution_ror, institution_country,
                        is_internal
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (work_id, author_position) DO NOTHING
                """,
                    (
                        work_id,
                        rid,
                        clean_openalex_id(author.get("id")),
                        author.get("display_name") or "(sin nombre)",
                        clean_orcid(author.get("orcid")),
                        pos,
                        a.get("is_corresponding"),
                        first_inst.get("display_name"),
                        first_inst.get("ror"),
                        (first_inst.get("country_code") or "")[:2] or None,
                        is_internal,
                    ),
                )
                n_auth += 1

            for sdg in w.get("sdgs") or []:
                resolved = resolve_sdg(sdg)
                if not resolved:
                    continue
                sid, sname = resolved
                cur.execute(
                    """
                    INSERT INTO work_sdgs (work_id, sdg_id, sdg_name, score)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (work_id, sdg_id) DO NOTHING
                """,
                    (work_id, sid, sname, None),
                )

            if n_works % 1000 == 0:
                print(f"    ... {n_works} obras")

        print(
            f"✓ Obras: {n_works}  "
            f"({n_without_oa} sin W-id pero con autores_uta; "
            f"{n_descartadas} descartadas en bucle)"
        )
        print(f"✓ Autorías: {n_auth}  ({n_auth_uta} de investigadores UTA)")
        print(f"✓ Fuentes: {len(source_ids)}")
        print(f"✓ Temas: {len(topic_ids)}")

    conn.commit()
    print("\n✓ Carga completa (commit).")

    print("\n" + "=" * 60)
    print("VERIFICACIÓN")
    print("=" * 60)
    with conn.cursor() as cur:
        checks = [
            ("Investigadores", "SELECT COUNT(*) c FROM researchers", 367),
            (
                "  con ORCID",
                "SELECT COUNT(*) c FROM researchers WHERE orcid IS NOT NULL",
                199,
            ),
            (
                "  con h-index",
                "SELECT COUNT(*) c FROM researchers WHERE h_index IS NOT NULL",
                None,
            ),
            ("Unidades", "SELECT COUNT(*) c FROM units", 32),
            ("Obras", "SELECT COUNT(*) c FROM works", 8607),
            ("Autorías", "SELECT COUNT(*) c FROM authorships", None),
            (
                "  de la UTA",
                "SELECT COUNT(*) c FROM authorships WHERE is_internal",
                None,
            ),
            ("Fuentes", "SELECT COUNT(*) c FROM sources", None),
        ]
        for label, sql, expected in checks:
            cur.execute(sql)
            n = cur.fetchone()["c"]
            mark = ""
            if expected is not None:
                mark = "  ✓" if n == expected else f"  ✗ (se esperaban {expected})"
            print(f"  {label:<22} {n:>8,}{mark}")

        cur.execute(
            """
            SELECT COUNT(DISTINCT a.work_id) c
            FROM authorships a
            JOIN researchers r ON r.id = a.researcher_id
            WHERE r.local_id = '04284161-7'
        """
        )
        n = cur.fetchone()["c"]
        print(
            f"\n  Rothhammer (04284161-7): {n} obras"
            + ("  ✓" if n == 120 else "  ✗ (se esperaban 120)")
        )

        cur.execute(
            """
            SELECT collaboration_scope, COUNT(*) c
            FROM v_work_collaboration
            GROUP BY collaboration_scope
            ORDER BY c DESC
        """
        )
        print("\n  Colaboración (antes imposible en el navegador):")
        for row in cur.fetchall():
            print(f"    {row['collaboration_scope']:<16} {row['c']:>6,} obras")

    conn.close()


if __name__ == "__main__":
    main()
