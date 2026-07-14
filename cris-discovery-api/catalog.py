"""
Catálogo institucional (Postgres) — investigadores, obras, unidades y analytics.

GET /researchers                    lista (q, unit, has_orcid, sdg, field, sort, page)
GET /researchers/{local_id}         detalle + métricas honestas (NULL ≠ 0)
GET /researchers/{id}/works         obras del investigador
GET /works                          producción (filtros, sort, facetas)
GET /units                          32 unidades + cobertura ORCID
GET /analytics/collaboration        internacional / nacional / institucional / sin_datos
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from db import get_conn

router = APIRouter(tags=["catálogo"])


# ---------------------------------------------------------------------------
# Modelos
# ---------------------------------------------------------------------------
class UnitBrief(BaseModel):
    id: int
    name: str
    role: Optional[str] = None
    is_primary: bool = True


class ResearcherMetrics(BaseModel):
    h_index: Optional[int] = None
    works_count: Optional[int] = None
    cited_by_count: Optional[int] = None
    mean_citedness: Optional[float] = None
    metrics_synced_at: Optional[str] = None


class ResearcherSummary(BaseModel):
    local_id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: str
    email: Optional[str] = None
    orcid: Optional[str] = None
    openalex_ids: list[str] = Field(default_factory=list)
    h_index: Optional[int] = None
    works_count: Optional[int] = None
    cited_by_count: Optional[int] = None
    units: list[UnitBrief] = Field(default_factory=list)


class ResearcherDetail(ResearcherSummary):
    position: Optional[str] = None
    metrics: ResearcherMetrics


class ResearchersListResponse(BaseModel):
    items: list[ResearcherSummary]
    total: int
    page: int
    per_page: int
    pages: int


class WorkItem(BaseModel):
    openalex_id: Optional[str] = None
    title: str
    year: Optional[int] = None
    doi: Optional[str] = None
    type: Optional[str] = None
    cited_by_count: Optional[int] = None
    fwci: Optional[float] = None
    is_oa: Optional[bool] = None
    oa_status: Optional[str] = None
    journal: Optional[str] = None
    sjr_quartile: Optional[str] = None
    author_position: Optional[int] = None


class ResearcherWorksResponse(BaseModel):
    local_id: str
    full_name: str
    total: int
    page: int
    per_page: int
    results: list[WorkItem]


class FacetCount(BaseModel):
    key: str
    count: int


class WorksFacets(BaseModel):
    year: list[FacetCount] = Field(default_factory=list)
    type: list[FacetCount] = Field(default_factory=list)
    quartile: list[FacetCount] = Field(default_factory=list)


class WorksListItem(BaseModel):
    openalex_id: Optional[str] = None
    title: str
    year: Optional[int] = None
    doi: Optional[str] = None
    type: Optional[str] = None
    cited_by_count: Optional[int] = None
    fwci: Optional[float] = None
    is_oa: Optional[bool] = None
    oa_status: Optional[str] = None
    journal: Optional[str] = None
    sjr_quartile: Optional[str] = None
    field: Optional[str] = None


class WorksListResponse(BaseModel):
    items: list[WorksListItem]
    total: int
    page: int
    per_page: int
    pages: int
    facets: WorksFacets


class UnitCoverage(BaseModel):
    id: int
    name: str
    total: int
    with_orcid: int
    pct: Optional[float] = None


class UnitsListResponse(BaseModel):
    total: int
    results: list[UnitCoverage]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _metrics_ts(value: Any) -> Optional[str]:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _openalex_ids(value: Any) -> list[str]:
    if not value:
        return []
    return list(value)


def _fetch_units_for(conn, researcher_ids: list[int]) -> dict[int, list[UnitBrief]]:
    if not researcher_ids:
        return {}
    rows = conn.execute(
        """
        SELECT ru.researcher_id, u.id, u.name, ru.role, ru.is_primary
        FROM researcher_units ru
        JOIN units u ON u.id = ru.unit_id
        WHERE ru.researcher_id = ANY(%s)
        ORDER BY ru.is_primary DESC, u.name
        """,
        (researcher_ids,),
    ).fetchall()
    out: dict[int, list[UnitBrief]] = {rid: [] for rid in researcher_ids}
    for row in rows:
        out[row["researcher_id"]].append(
            UnitBrief(
                id=row["id"],
                name=row["name"],
                role=row["role"],
                is_primary=bool(row["is_primary"]),
            )
        )
    return out


def _row_to_summary(row: dict, units: list[UnitBrief]) -> ResearcherSummary:
    return ResearcherSummary(
        local_id=row["local_id"],
        first_name=row.get("first_name"),
        last_name=row.get("last_name"),
        full_name=row["full_name"] or "",
        email=row.get("email"),
        orcid=row.get("orcid"),
        openalex_ids=_openalex_ids(row.get("openalex_ids")),
        h_index=row.get("h_index"),
        works_count=row.get("works_count"),
        cited_by_count=row.get("cited_by_count"),
        units=units,
    )


def _resolve_researcher(conn, key: str) -> dict:
    """Resuelve por local_id (RUT) o, si es numérico, por id serial."""
    row = conn.execute(
        """
        SELECT id, local_id, first_name, last_name, full_name, email, phone,
               position, gender, orcid, openalex_ids,
               h_index, works_count, cited_by_count, mean_citedness,
               metrics_synced_at
        FROM researchers
        WHERE local_id = %s
        """,
        (key,),
    ).fetchone()
    if row:
        return row
    if key.isdigit():
        row = conn.execute(
            """
            SELECT id, local_id, first_name, last_name, full_name, email, phone,
                   position, gender, orcid, openalex_ids,
                   h_index, works_count, cited_by_count, mean_citedness,
                   metrics_synced_at
            FROM researchers
            WHERE id = %s
            """,
            (int(key),),
        ).fetchone()
        if row:
            return row
    raise HTTPException(status_code=404, detail=f"Investigador no encontrado: {key}")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/researchers", response_model=ResearchersListResponse)
def list_researchers(
    q: Optional[str] = Query(
        None, min_length=2, description="Nombre (pg_trgm + unaccent)"
    ),
    unit: Optional[str] = Query(
        None, description="Nombre de unidad (parcial, sin tildes)"
    ),
    has_orcid: Optional[bool] = Query(
        None, description="true = con ORCID, false = sin"
    ),
    sdg: Optional[int] = Query(
        None, ge=1, le=17, description="ODS 1..17 (obra con ese SDG)"
    ),
    field: Optional[str] = Query(
        None, description="Área temática OpenAlex (topics.field)"
    ),
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=200),
    sort: Literal["name", "h_index"] = Query(
        "name", description="name | h_index"
    ),
):
    where: list[str] = ["1=1"]
    where_params: list[Any] = []
    order_bits: list[str] = []
    order_params: list[Any] = []

    if unit:
        where.append(
            "EXISTS ("
            "  SELECT 1 FROM researcher_units ru"
            "  JOIN units u ON u.id = ru.unit_id"
            "  WHERE ru.researcher_id = r.id"
            "    AND unaccent(u.name) ILIKE unaccent(%s)"
            ")"
        )
        where_params.append(f"%{unit.strip()}%")

    if has_orcid is True:
        where.append("r.orcid IS NOT NULL")
    elif has_orcid is False:
        where.append("r.orcid IS NULL")

    if sdg is not None:
        where.append(
            "EXISTS ("
            "  SELECT 1 FROM authorships a"
            "  JOIN work_sdgs ws ON ws.work_id = a.work_id"
            "  WHERE a.researcher_id = r.id AND ws.sdg_id = %s"
            ")"
        )
        where_params.append(sdg)

    if field:
        where.append(
            "EXISTS ("
            "  SELECT 1 FROM authorships a"
            "  JOIN works w ON w.id = a.work_id"
            "  JOIN topics t ON t.id = w.primary_topic_id"
            "  WHERE a.researcher_id = r.id"
            "    AND unaccent(t.field) ILIKE unaccent(%s)"
            ")"
        )
        where_params.append(field.strip())

    if q:
        q_clean = q.strip()
        # pg_trgm: typos ("rothamer") + unaccent ("Nunez" → "Núñez")
        where.append("unaccent(r.full_name) %% unaccent(%s)")
        where_params.append(q_clean)
        order_bits.append(
            "similarity(unaccent(r.full_name), unaccent(%s)) DESC"
        )
        order_params.append(q_clean)

    if sort == "h_index":
        order_bits.extend(
            [
                "r.h_index DESC NULLS LAST",
                "r.last_name NULLS LAST",
                "r.first_name NULLS LAST",
            ]
        )
    else:
        order_bits.extend(
            ["r.last_name NULLS LAST", "r.first_name NULLS LAST"]
        )

    where_sql = " AND ".join(where)
    order_sql = ", ".join(order_bits)
    offset = (page - 1) * per_page

    with get_conn() as conn:
        # Default trgm ≈ 0.3 deja fuera typos cortos (rothamer→Rothhammer ≈ 0.24).
        if q:
            conn.execute("SELECT set_limit(0.2)")

        total = conn.execute(
            f"SELECT COUNT(*) AS c FROM researchers r WHERE {where_sql}",
            where_params,
        ).fetchone()["c"]

        rows = conn.execute(
            f"""
            SELECT r.id, r.local_id, r.first_name, r.last_name, r.full_name,
                   r.email, r.orcid, r.openalex_ids,
                   r.h_index, r.works_count, r.cited_by_count
            FROM researchers r
            WHERE {where_sql}
            ORDER BY {order_sql}
            LIMIT %s OFFSET %s
            """,
            [*where_params, *order_params, per_page, offset],
        ).fetchall()

        units_map = _fetch_units_for(conn, [r["id"] for r in rows])

    items = [_row_to_summary(r, units_map.get(r["id"], [])) for r in rows]
    pages = (total + per_page - 1) // per_page if per_page else 0
    return ResearchersListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.get("/researchers/{researcher_key}", response_model=ResearcherDetail)
def get_researcher(researcher_key: str):
    with get_conn() as conn:
        row = _resolve_researcher(conn, researcher_key)
        units = _fetch_units_for(conn, [row["id"]]).get(row["id"], [])

    summary = _row_to_summary(row, units)
    return ResearcherDetail(
        **summary.model_dump(),
        position=row.get("position"),
        metrics=ResearcherMetrics(
            h_index=row.get("h_index"),
            works_count=row.get("works_count"),
            cited_by_count=row.get("cited_by_count"),
            mean_citedness=(
                float(row["mean_citedness"])
                if row.get("mean_citedness") is not None
                else None
            ),
            metrics_synced_at=_metrics_ts(row.get("metrics_synced_at")),
        ),
    )


@router.get("/researchers/{researcher_key}/works", response_model=ResearcherWorksResponse)
def get_researcher_works(
    researcher_key: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    year_from: Optional[int] = Query(None),
    year_to: Optional[int] = Query(None),
):
    with get_conn() as conn:
        researcher = _resolve_researcher(conn, researcher_key)
        rid = researcher["id"]

        where = ["a.researcher_id = %s"]
        params: list[Any] = [rid]
        if year_from is not None:
            where.append("w.publication_year >= %s")
            params.append(year_from)
        if year_to is not None:
            where.append("w.publication_year <= %s")
            params.append(year_to)
        where_sql = " AND ".join(where)
        offset = (page - 1) * per_page

        total = conn.execute(
            f"""
            SELECT COUNT(*) AS c
            FROM authorships a
            JOIN works w ON w.id = a.work_id
            WHERE {where_sql}
            """,
            params,
        ).fetchone()["c"]

        rows = conn.execute(
            f"""
            SELECT w.openalex_id, w.title, w.publication_year AS year, w.doi,
                   w.type, w.cited_by_count, w.fwci, w.is_oa, w.oa_status,
                   s.name AS journal, s.sjr_quartile, a.author_position
            FROM authorships a
            JOIN works w ON w.id = a.work_id
            LEFT JOIN sources s ON s.id = w.source_id
            WHERE {where_sql}
            ORDER BY w.publication_year DESC NULLS LAST, w.cited_by_count DESC NULLS LAST
            LIMIT %s OFFSET %s
            """,
            [*params, per_page, offset],
        ).fetchall()

    results = [
        WorkItem(
            openalex_id=r.get("openalex_id"),
            title=r["title"],
            year=r.get("year"),
            doi=r.get("doi"),
            type=r.get("type"),
            cited_by_count=r.get("cited_by_count"),
            fwci=float(r["fwci"]) if r.get("fwci") is not None else None,
            is_oa=r.get("is_oa"),
            oa_status=r.get("oa_status"),
            journal=r.get("journal"),
            sjr_quartile=r.get("sjr_quartile"),
            author_position=r.get("author_position"),
        )
        for r in rows
    ]
    return ResearcherWorksResponse(
        local_id=researcher["local_id"],
        full_name=researcher["full_name"] or "",
        total=total,
        page=page,
        per_page=per_page,
        results=results,
    )


def _works_filter_sql(
    *,
    q: Optional[str],
    year_from: Optional[int],
    year_to: Optional[int],
    type: Optional[str],
    is_oa: Optional[bool],
    quartile: Optional[str],
    unit: Optional[str],
    researcher: Optional[str],
    sdg: Optional[int],
    field: Optional[str],
) -> tuple[str, list[Any], list[Any]]:
    """Devuelve (WHERE, where_params, order_extra_params para similarity)."""
    where: list[str] = ["1=1"]
    params: list[Any] = []
    order_params: list[Any] = []

    if q:
        q_clean = q.strip()
        where.append(
            "("
            "  unaccent(w.title) ILIKE unaccent(%s)"
            "  OR unaccent(w.title) %% unaccent(%s)"
            ")"
        )
        params.extend([f"%{q_clean}%", q_clean])
        order_params.append(q_clean)

    if year_from is not None:
        where.append("w.publication_year >= %s")
        params.append(year_from)
    if year_to is not None:
        where.append("w.publication_year <= %s")
        params.append(year_to)

    if type:
        where.append("w.type = %s")
        params.append(type.strip())

    if is_oa is True:
        where.append("w.is_oa IS TRUE")
    elif is_oa is False:
        where.append("w.is_oa IS NOT TRUE")

    if quartile:
        where.append("s.sjr_quartile = %s")
        params.append(quartile.upper())

    if unit:
        where.append(
            "EXISTS ("
            "  SELECT 1 FROM authorships a"
            "  JOIN researcher_units ru ON ru.researcher_id = a.researcher_id"
            "  JOIN units u ON u.id = ru.unit_id"
            "  WHERE a.work_id = w.id"
            "    AND unaccent(u.name) ILIKE unaccent(%s)"
            ")"
        )
        params.append(f"%{unit.strip()}%")

    if researcher:
        where.append(
            "EXISTS ("
            "  SELECT 1 FROM authorships a"
            "  JOIN researchers r ON r.id = a.researcher_id"
            "  WHERE a.work_id = w.id AND r.local_id = %s"
            ")"
        )
        params.append(researcher.strip())

    if sdg is not None:
        where.append(
            "EXISTS ("
            "  SELECT 1 FROM work_sdgs ws"
            "  WHERE ws.work_id = w.id AND ws.sdg_id = %s"
            ")"
        )
        params.append(sdg)

    if field:
        where.append("unaccent(t.field) ILIKE unaccent(%s)")
        params.append(field.strip())

    return " AND ".join(where), params, order_params


@router.get("/works", response_model=WorksListResponse)
def list_works(
    q: Optional[str] = Query(None, min_length=2, description="Título (pg_trgm + unaccent)"),
    year_from: Optional[int] = Query(None),
    year_to: Optional[int] = Query(None),
    type: Optional[str] = Query(None, description="article, review, …"),
    is_oa: Optional[bool] = Query(None),
    quartile: Optional[str] = Query(None, description="Q1–Q4 (sources.sjr_quartile)"),
    unit: Optional[str] = Query(None, description="Unidad (nombre parcial)"),
    researcher: Optional[str] = Query(None, description="local_id / RUT"),
    sdg: Optional[int] = Query(None, ge=1, le=17),
    field: Optional[str] = Query(None, description="Área OpenAlex (topics.field)"),
    sort: Literal["year", "citations", "fwci"] = Query("year"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
):
    """Producción institucional con facetas sobre los filtros activos."""
    where_sql, where_params, order_params = _works_filter_sql(
        q=q,
        year_from=year_from,
        year_to=year_to,
        type=type,
        is_oa=is_oa,
        quartile=quartile,
        unit=unit,
        researcher=researcher,
        sdg=sdg,
        field=field,
    )

    if sort == "citations":
        order_sql = "w.cited_by_count DESC NULLS LAST, w.publication_year DESC NULLS LAST"
    elif sort == "fwci":
        order_sql = "w.fwci DESC NULLS LAST, w.cited_by_count DESC NULLS LAST"
    else:
        order_sql = "w.publication_year DESC NULLS LAST, w.cited_by_count DESC NULLS LAST"

    if q:
        order_sql = (
            "similarity(unaccent(w.title), unaccent(%s)) DESC, " + order_sql
        )

    from_sql = """
        FROM works w
        LEFT JOIN sources s ON s.id = w.source_id
        LEFT JOIN topics t ON t.id = w.primary_topic_id
    """
    offset = (page - 1) * per_page

    with get_conn() as conn:
        if q:
            conn.execute("SELECT set_limit(0.2)")

        total = conn.execute(
            f"SELECT COUNT(*) AS c {from_sql} WHERE {where_sql}",
            where_params,
        ).fetchone()["c"]

        rows = conn.execute(
            f"""
            SELECT w.openalex_id, w.title, w.publication_year AS year, w.doi,
                   w.type, w.cited_by_count, w.fwci, w.is_oa, w.oa_status,
                   s.name AS journal, s.sjr_quartile, t.field
            {from_sql}
            WHERE {where_sql}
            ORDER BY {order_sql}
            LIMIT %s OFFSET %s
            """,
            [*where_params, *order_params, per_page, offset],
        ).fetchall()

        # Facetas sobre el mismo conjunto filtrado
        year_rows = conn.execute(
            f"""
            SELECT w.publication_year::text AS key, COUNT(*) AS count
            {from_sql}
            WHERE {where_sql} AND w.publication_year IS NOT NULL
            GROUP BY w.publication_year
            ORDER BY w.publication_year DESC
            """,
            where_params,
        ).fetchall()
        type_rows = conn.execute(
            f"""
            SELECT w.type AS key, COUNT(*) AS count
            {from_sql}
            WHERE {where_sql} AND w.type IS NOT NULL
            GROUP BY w.type
            ORDER BY count DESC, w.type
            """,
            where_params,
        ).fetchall()
        quartile_rows = conn.execute(
            f"""
            SELECT s.sjr_quartile AS key, COUNT(*) AS count
            {from_sql}
            WHERE {where_sql} AND s.sjr_quartile IS NOT NULL
            GROUP BY s.sjr_quartile
            ORDER BY s.sjr_quartile
            """,
            where_params,
        ).fetchall()

    items = [
        WorksListItem(
            openalex_id=r.get("openalex_id"),
            title=r["title"],
            year=r.get("year"),
            doi=r.get("doi"),
            type=r.get("type"),
            cited_by_count=r.get("cited_by_count"),
            fwci=float(r["fwci"]) if r.get("fwci") is not None else None,
            is_oa=r.get("is_oa"),
            oa_status=r.get("oa_status"),
            journal=r.get("journal"),
            sjr_quartile=r.get("sjr_quartile"),
            field=r.get("field"),
        )
        for r in rows
    ]
    pages = (total + per_page - 1) // per_page if per_page else 0
    facets = WorksFacets(
        year=[FacetCount(key=r["key"], count=r["count"]) for r in year_rows],
        type=[FacetCount(key=r["key"], count=r["count"]) for r in type_rows],
        quartile=[FacetCount(key=r["key"], count=r["count"]) for r in quartile_rows],
    )
    return WorksListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
        facets=facets,
    )


@router.get("/units", response_model=UnitsListResponse)
def list_units():
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT unit_id AS id, unit_name AS name, total, with_orcid, pct
            FROM v_unit_orcid_coverage
            ORDER BY unit_name
            """
        ).fetchall()

    results = [
        UnitCoverage(
            id=r["id"],
            name=r["name"],
            total=r["total"] or 0,
            with_orcid=r["with_orcid"] or 0,
            pct=float(r["pct"]) if r.get("pct") is not None else None,
        )
        for r in rows
    ]
    return UnitsListResponse(total=len(results), results=results)


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
SCOPES = ("internacional", "nacional", "institucional", "sin_datos")


class CollaborationScopeCounts(BaseModel):
    internacional: int = 0
    nacional: int = 0
    institucional: int = 0
    sin_datos: int = 0


class CollaborationPct(BaseModel):
    """Porcentajes sobre obras clasificables (excluye sin_datos)."""
    internacional: int = 0
    nacional: int = 0
    institucional: int = 0


class CollaborationYearRow(BaseModel):
    year: int
    internacional: int = 0
    nacional: int = 0
    institucional: int = 0
    sin_datos: int = 0
    total: int = 0


class CollaborationAnalyticsResponse(BaseModel):
    total_works: int
    classified: int
    unclassified: int
    by_scope: CollaborationScopeCounts
    pct: CollaborationPct
    note: str
    by_year: Optional[list[CollaborationYearRow]] = None


@router.get("/analytics/collaboration", response_model=CollaborationAnalyticsResponse)
def analytics_collaboration(
    year_from: Optional[int] = Query(None),
    year_to: Optional[int] = Query(None),
    by_year: bool = Query(False, description="Desglose por año de publicación"),
):
    """Alcance de colaboración vía v_work_collaboration."""
    where = ["1=1"]
    params: list[Any] = []
    if year_from is not None:
        where.append("publication_year >= %s")
        params.append(year_from)
    if year_to is not None:
        where.append("publication_year <= %s")
        params.append(year_to)
    where_sql = " AND ".join(where)

    with get_conn() as conn:
        rows = conn.execute(
            f"""
            SELECT collaboration_scope, COUNT(*) AS c
            FROM v_work_collaboration
            WHERE {where_sql}
            GROUP BY collaboration_scope
            """,
            params,
        ).fetchall()

        year_rows: list[CollaborationYearRow] | None = None
        if by_year:
            yraw = conn.execute(
                f"""
                SELECT publication_year AS year,
                       collaboration_scope,
                       COUNT(*) AS c
                FROM v_work_collaboration
                WHERE {where_sql}
                  AND publication_year IS NOT NULL
                GROUP BY publication_year, collaboration_scope
                ORDER BY publication_year
                """,
                params,
            ).fetchall()
            by_y: dict[int, dict[str, int]] = {}
            for r in yraw:
                y = int(r["year"])
                bucket = by_y.setdefault(y, {s: 0 for s in SCOPES})
                scope = r["collaboration_scope"]
                if scope in bucket:
                    bucket[scope] = r["c"]
            year_rows = [
                CollaborationYearRow(
                    year=y,
                    internacional=b["internacional"],
                    nacional=b["nacional"],
                    institucional=b["institucional"],
                    sin_datos=b["sin_datos"],
                    total=sum(b.values()),
                )
                for y, b in sorted(by_y.items())
            ]

    counts = {s: 0 for s in SCOPES}
    for r in rows:
        scope = r["collaboration_scope"]
        if scope in counts:
            counts[scope] = r["c"]

    total_works = sum(counts.values())
    unclassified = counts["sin_datos"]
    classified = total_works - unclassified

    def _pct(n: int) -> int:
        return round(100.0 * n / classified) if classified else 0

    note = (
        f"{unclassified} obras sin datos de afiliación (no indexadas en OpenAlex); "
        f"los porcentajes se calculan sobre las {classified:,} clasificables".replace(",", ".")
    )

    return CollaborationAnalyticsResponse(
        total_works=total_works,
        classified=classified,
        unclassified=unclassified,
        by_scope=CollaborationScopeCounts(**counts),
        pct=CollaborationPct(
            internacional=_pct(counts["internacional"]),
            nacional=_pct(counts["nacional"]),
            institucional=_pct(counts["institucional"]),
        ),
        note=note,
        by_year=year_rows,
    )
