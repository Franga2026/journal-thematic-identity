"""
CRIS Victoria — Descubridor bibliográfico universal
Proxy FastAPI para búsqueda en vivo contra la API de OpenAlex.

CAPA A: facetas con conteo (group_by), filtros ampliados (tipo, oa_status,
área, editorial), campos nuevos (abstract, editorial, área, ISSN) y orden
ascendente por fecha.

CAPA B: cuartil SJR (Scimago 2025) vía mapa ISSN local (sjr-2025-quartiles.json),
faceta Q1–Q4 y filtro por cuartil (no aplica a datasets).

La API key de OpenAlex se guarda SOLO en el servidor (variable de entorno).

Arranque local (puerto 8002 — NO 8000/8001, esos son del Catalogador IA):
    pip install -r requirements.txt
    source .env
    uvicorn main:app --reload --port 8002
"""

import os
import re
import json
import time
import hashlib
import asyncio
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ----------------------------------------------------------------------
# Configuración
# ----------------------------------------------------------------------
OPENALEX_API_KEY = os.environ.get("OPENALEX_API_KEY", "").strip()
OPENALEX_BASE = "https://api.openalex.org"
CONTACT_EMAIL = os.environ.get("OPENALEX_CONTACT_EMAIL", "").strip()

ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
).split(",")

CACHE_TTL_SECONDS = int(os.environ.get("CACHE_TTL_SECONDS", "3600"))
RATE_LIMIT_MAX = int(os.environ.get("RATE_LIMIT_MAX", "60"))
RATE_LIMIT_WINDOW = int(os.environ.get("RATE_LIMIT_WINDOW", "60"))

# Campos que pedimos a OpenAlex (select). Capa A añade primary_topic,
# host_organization (editorial), abstract_inverted_index e ISSN.
SELECT_FIELDS = (
    "id,display_name,title,publication_year,doi,type,cited_by_count,"
    "fwci,open_access,primary_location,primary_topic,authorships,"
    "abstract_inverted_index"
)

app = FastAPI(
    title="CRIS Victoria — Descubridor bibliográfico",
    description="Proxy de búsqueda en vivo contra OpenAlex (474M obras).",
    version="2.1.0",
)

# Mapa ISSN → cuartil SJR (Scimago 2025). Misma fuente que enrich-quartile.ts.
_DEFAULT_SJR = (
    Path(__file__).resolve().parent.parent / "scripts" / "data" / "sjr-2025-quartiles.json"
)
SJR_MAP_PATH = Path(os.environ.get("SJR_QUARTILES_PATH", str(_DEFAULT_SJR)))
QUARTILE_MAX_OA_PAGES = int(os.environ.get("QUARTILE_MAX_OA_PAGES", "12"))
QUARTILE_FILTER_MAX_ISSNS = int(os.environ.get("QUARTILE_FILTER_MAX_ISSNS", "100"))
# OpenAlex rechaza filtros ISSN muy largos (~1.1k chars); recortamos por presupuesto.
QUARTILE_ISSN_FILTER_MAX_CHARS = int(os.environ.get("QUARTILE_ISSN_FILTER_MAX_CHARS", "850"))
LINKED_DATASETS_MAX = int(os.environ.get("LINKED_DATASETS_MAX", "3"))
LINKED_DATASETS_ENRICH = os.environ.get("LINKED_DATASETS_ENRICH", "1") != "0"
_ISSN_RE = re.compile(r"^[0-9X]{8}$")
_OA_ENTITY_RE = re.compile(r"^[PI]\d+$", re.IGNORECASE)
_WIKIDATA_Q_RE = re.compile(r"^Q\d+$", re.IGNORECASE)
QUARTILE_RANK = {"Q1": 1, "Q2": 2, "Q3": 3, "Q4": 4}
BOOK_SOURCE_TYPES = frozenset({"book", "ebook"})
JOURNAL_SOURCE_TYPES = frozenset({"journal", "journal-series", "conference"})
JOURNAL_WORK_TYPES = frozenset({"article", "review", "letter", "editorial"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ----------------------------------------------------------------------
# Caché y rate limit en memoria
# ----------------------------------------------------------------------
_cache: dict[str, tuple[float, dict]] = {}
_linked_ds_cache: dict[str, tuple[float, tuple[list[LinkedDataset], int]]] = {}
_rate: dict[str, list[float]] = {}


def _cache_get(key: str) -> Optional[dict]:
    hit = _cache.get(key)
    if not hit:
        return None
    expires_at, payload = hit
    if time.time() > expires_at:
        _cache.pop(key, None)
        return None
    return payload


def _cache_set(key: str, payload: dict) -> None:
    _cache[key] = (time.time() + CACHE_TTL_SECONDS, payload)


def _linked_ds_cache_get(work_id: str) -> Optional[tuple[list[LinkedDataset], int]]:
    hit = _linked_ds_cache.get(work_id)
    if not hit:
        return None
    expires_at, payload = hit
    if time.time() > expires_at:
        _linked_ds_cache.pop(work_id, None)
        return None
    return payload


def _linked_ds_cache_set(work_id: str, datasets: list[LinkedDataset], count: int) -> None:
    _linked_ds_cache[work_id] = (time.time() + CACHE_TTL_SECONDS, (datasets, count))


def _check_rate(ip: str) -> bool:
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW
    hits = [t for t in _rate.get(ip, []) if t > window_start]
    if len(hits) >= RATE_LIMIT_MAX:
        _rate[ip] = hits
        return False
    hits.append(now)
    _rate[ip] = hits
    return True


# ----------------------------------------------------------------------
# Modelos de respuesta
# ----------------------------------------------------------------------
class WorkAuthor(BaseModel):
    name: str
    orcid: Optional[str] = None


class LinkedDataset(BaseModel):
    openalex_id: str
    title: str
    doi: Optional[str] = None
    url: Optional[str] = None


class WorkResult(BaseModel):
    openalex_id: str
    title: str
    year: Optional[int] = None
    doi: Optional[str] = None
    type: Optional[str] = None
    cited_by_count: int = 0
    fwci: Optional[float] = None
    is_oa: bool = False
    oa_status: Optional[str] = None
    oa_url: Optional[str] = None
    journal: Optional[str] = None
    publisher: Optional[str] = None        # editorial / repositorio (Capa A)
    field: Optional[str] = None            # área temática (Capa A)
    issn_l: Optional[str] = None           # ISSN linking de la fuente (Capa B)
    quartile: Optional[str] = None         # Q1–Q4 SJR/Scimago (Capa B)
    abstract: Optional[str] = None         # abstract reconstruido (Capa A)
    authors: list[WorkAuthor] = []
    linked_datasets: list[LinkedDataset] = []
    linked_datasets_count: int = 0
    source_type: Optional[str] = None       # journal | book | repository | …
    is_journal_article: bool = False        # True solo si es artículo de revista (cuartil SJR)


class SearchResponse(BaseModel):
    query: str
    total: int
    page: int
    per_page: int
    cost_usd: float
    cached: bool
    results: list[WorkResult]


class FacetBucket(BaseModel):
    key: str
    label: str
    count: int


class FacetsResponse(BaseModel):
    query: str
    cached: bool
    cost_usd: float
    types: list[FacetBucket] = []
    oa_status: list[FacetBucket] = []
    fields: list[FacetBucket] = []
    publishers: list[FacetBucket] = []
    repositories: list[FacetBucket] = []
    dataset_repositories: list[FacetBucket] = []
    quartiles: list[FacetBucket] = []      # Capa B: SJR Q1–Q4


# ----------------------------------------------------------------------
# Mapa SJR (Scimago) — carga perezosa
# ----------------------------------------------------------------------
_sjr_map: Optional[dict[str, str]] = None


def _load_sjr_map() -> dict[str, str]:
    global _sjr_map
    if _sjr_map is not None:
        return _sjr_map
    if not SJR_MAP_PATH.is_file():
        _sjr_map = {}
        return _sjr_map
    with SJR_MAP_PATH.open(encoding="utf-8") as f:
        raw = json.load(f)
    _sjr_map = {str(k): str(v) for k, v in raw.items() if v in ("Q1", "Q2", "Q3", "Q4")}
    return _sjr_map


def _norm_issn(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    v = raw.strip().upper().replace("-", "")
    if re.fullmatch(r"\d+\.0", v):
        v = f"{int(round(float(v))):08d}"
    elif re.fullmatch(r"\d+", v):
        v = f"{int(v):08d}"
    return v if len(v) == 8 and _ISSN_RE.fullmatch(v) else None


def _issn_candidates_from_source(source: dict) -> list[str]:
    """ISSN candidatos de OpenAlex: issn_l + issn[] (como enrich-quartile / Scopus)."""
    if not isinstance(source, dict):
        return []
    out: list[str] = []
    if source.get("issn_l"):
        out.append(str(source["issn_l"]))
    for raw in source.get("issn") or []:
        if raw:
            out.append(str(raw))
    return out


def _best_quartile_from_issns(issns: list[str]) -> tuple[Optional[str], Optional[str]]:
    """Mejor cuartil SJR (Q1>Q2>Q3>Q4) cruzando candidatos ISSN con la KB Scimago."""
    sjr = _load_sjr_map()
    if not sjr:
        return None, None
    best: Optional[str] = None
    matched: Optional[str] = None
    for raw in issns:
        norm = _norm_issn(raw)
        if not norm:
            continue
        q = sjr.get(norm)
        if not q or q not in QUARTILE_RANK:
            continue
        if best is None or QUARTILE_RANK[q] < QUARTILE_RANK[best]:
            best = q
            matched = norm
    return best, matched


def _sanitize_display_label(raw: Optional[str]) -> Optional[str]:
    """Descarta etiquetas técnicas (Wikidata Q…, ids OpenAlex) no aptas para mostrar."""
    v = (raw or "").strip()
    if not v or len(v) < 2:
        return None
    # Q1–Q4 son cuartiles SJR, no ids Wikidata (estos tienen más dígitos: Q16635223).
    if v.upper() in QUARTILE_RANK:
        return v
    if _WIKIDATA_Q_RE.match(v) or _OA_ENTITY_RE.match(v):
        return None
    return v


def _looks_like_book_doi(doi: Optional[str]) -> bool:
    """DOI típico de capítulo/libro (Elsevier/Springer CRC, etc.)."""
    if not doi:
        return False
    d = doi.lower().replace("https://doi.org/", "")
    return bool(
        re.search(r"10\.1016/b\d", d)
        or re.search(r"10\.1007/978[-0-9]", d)
        or re.search(r"10\.1201/978", d)
        or re.search(r"10\.4324/978", d)
    )


def _resolve_work_type(raw_type: Optional[str], source: dict, doi: Optional[str]) -> str:
    """Capítulos de libro no deben clasificarse como artículos de revista."""
    wt = (raw_type or "").strip() or "other"
    src_type = (source.get("type") or "").strip().lower()

    if wt in ("book", "book-chapter", "dataset"):
        return wt

    if wt in JOURNAL_WORK_TYPES or wt == "preprint":
        if src_type in BOOK_SOURCE_TYPES or _looks_like_book_doi(doi):
            return "book-chapter"
    return wt


def _is_journal_article(work_type: str, source: dict) -> bool:
    """Artículo indexado en revista científica (aplica cuartil SJR)."""
    if work_type not in JOURNAL_WORK_TYPES:
        return False
    src_type = (source.get("type") or "").strip().lower()
    if src_type in BOOK_SOURCE_TYPES:
        return False
    if src_type in JOURNAL_SOURCE_TYPES:
        return True
    # Revista sin type explícito pero con ISSN (no repositorio/libro)
    if source.get("issn_l") and src_type not in ("repository", "book", "ebook", ""):
        return src_type not in ("repository",)
    return bool(source.get("issn_l")) and src_type not in ("repository", "book", "ebook")


def _normalize_openalex_entity_id(raw: Optional[str]) -> Optional[str]:
    """ID de entidad OpenAlex (P… editorial, I… institución) desde clave o URL."""
    v = (raw or "").strip()
    if not v:
        return None
    if v.startswith("http"):
        v = v.rsplit("/", 1)[-1]
    if _OA_ENTITY_RE.match(v):
        return v.upper() if v[0] in "pP" else v  # P mayúscula, I conserva casing
    return None


def _normalize_field_id(raw: Optional[str]) -> Optional[str]:
    """Id numérico de área temática (primary_topic.field.id)."""
    v = (raw or "").strip()
    if not v:
        return None
    if v.startswith("http"):
        v = v.rsplit("/", 1)[-1]
    return v if v.isdigit() else None


def _kb_issns_for_quartile(quartile: str) -> list[str]:
    """Todos los ISSN del mapa SJR para un cuartil (p. ej. ~10k para Q4)."""
    sjr = _load_sjr_map()
    return [issn for issn, q in sjr.items() if q == quartile]


def _trim_issns_for_oa_filter(issns: list[str]) -> list[str]:
    """Recorta la lista ISSN para no superar el límite de longitud de OpenAlex."""
    out: list[str] = []
    for issn in issns:
        trial = out + [issn]
        flt = f"primary_location.source.issn:{'|'.join(trial)}"
        if len(flt) > QUARTILE_ISSN_FILTER_MAX_CHARS:
            break
        out = trial
    return out


def _aggregate_quartile_buckets(issn_groups: list[dict]) -> list[FacetBucket]:
    """Agrega conteos group_by ISSN → buckets Q1–Q4 (siempre los cuatro)."""
    sjr = _load_sjr_map()
    counts = {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0}
    if sjr:
        for b in issn_groups:
            norm = _norm_issn(str(b.get("key") or ""))
            q = sjr.get(norm) if norm else None
            if q in counts:
                counts[q] += int(b.get("count") or 0)
    return [
        FacetBucket(key=q, label=q, count=counts[q])
        for q in ("Q1", "Q2", "Q3", "Q4")
    ]


# ----------------------------------------------------------------------
# Helpers de normalización
# ----------------------------------------------------------------------
def _clean_id(oa_id: Optional[str]) -> str:
    if not oa_id:
        return ""
    return oa_id.rsplit("/", 1)[-1]


def _reconstruct_abstract(inv_index: Optional[dict], max_chars: int = 320) -> Optional[str]:
    """Reconstruye el abstract desde el índice invertido de OpenAlex."""
    if not inv_index or not isinstance(inv_index, dict):
        return None
    positions: list[tuple[int, str]] = []
    for word, idxs in inv_index.items():
        for i in idxs:
            positions.append((i, word))
    if not positions:
        return None
    positions.sort(key=lambda x: x[0])
    text = " ".join(w for _, w in positions)
    if len(text) > max_chars:
        text = text[:max_chars].rsplit(" ", 1)[0] + "…"
    return text


def _dataset_access_url(w: dict) -> Optional[str]:
    """URL de acceso a un dataset (OA > landing > DOI)."""
    oa = w.get("open_access") or {}
    if oa.get("oa_url"):
        return str(oa["oa_url"])
    primary = w.get("primary_location") or {}
    if isinstance(primary, dict):
        for key in ("landing_page_url", "pdf_url"):
            if primary.get(key):
                return str(primary[key])
    doi = w.get("doi")
    if doi:
        return doi if str(doi).startswith("http") else f"https://doi.org/{doi}"
    oa_id = _clean_id(w.get("id"))
    return f"https://openalex.org/works/{oa_id}" if oa_id else None


async def _fetch_linked_datasets(
    client: httpx.AsyncClient,
    work_id: str,
) -> tuple[list[LinkedDataset], int]:
    """Datasets en OpenAlex que referencian esta obra (filter cites + type:dataset)."""
    cached = _linked_ds_cache_get(work_id)
    if cached:
        return cached

    params = {
        "filter": f"cites:{work_id},type:dataset",
        "per-page": LINKED_DATASETS_MAX,
        "select": "id,display_name,doi,primary_location,open_access",
        "api_key": OPENALEX_API_KEY,
    }
    if CONTACT_EMAIL:
        params["mailto"] = CONTACT_EMAIL
    data = await _try_openalex_get(client, f"{OPENALEX_BASE}/works", params)
    if not data:
        _linked_ds_cache_set(work_id, [], 0)
        return [], 0

    meta = data.get("meta") or {}
    count = int(meta.get("count", 0) or 0)
    out: list[LinkedDataset] = []
    for w in data.get("results") or []:
        doi = w.get("doi")
        if doi and str(doi).startswith("https://doi.org/"):
            doi = str(doi)[len("https://doi.org/"):]
        out.append(LinkedDataset(
            openalex_id=_clean_id(w.get("id")),
            title=w.get("display_name") or w.get("title") or "Dataset",
            doi=doi,
            url=_dataset_access_url(w),
        ))

    _linked_ds_cache_set(work_id, out, count)
    return out, count


async def _enrich_linked_datasets(
    client: httpx.AsyncClient,
    results: list[WorkResult],
) -> None:
    """Añade datasets vinculados a obras que no son type=dataset."""
    if not LINKED_DATASETS_ENRICH:
        return
    targets = [r for r in results if r.type != "dataset" and r.openalex_id]
    if not targets:
        return
    batches = await asyncio.gather(
        *[_fetch_linked_datasets(client, r.openalex_id) for r in targets],
        return_exceptions=True,
    )
    for wr, batch in zip(targets, batches):
        if isinstance(batch, Exception):
            continue
        datasets, count = batch
        wr.linked_datasets = datasets
        wr.linked_datasets_count = count


def normalize_work(w: dict) -> WorkResult:
    authors = []
    for a in (w.get("authorships") or [])[:5]:
        au = a.get("author") or {}
        authors.append(WorkAuthor(
            name=au.get("display_name") or "—",
            orcid=(au.get("orcid") or "").rsplit("/", 1)[-1] or None,
        ))

    primary = w.get("primary_location") or {}
    source = (primary.get("source") or {}) if isinstance(primary, dict) else {}
    journal = source.get("display_name")
    publisher = _sanitize_display_label(source.get("host_organization_name"))
    issn_l = source.get("issn_l")

    topic = w.get("primary_topic") or {}
    field_obj = (topic.get("field") or {}) if isinstance(topic, dict) else {}
    field = field_obj.get("display_name")

    oa = w.get("open_access") or {}
    is_oa = bool(oa.get("is_oa"))
    oa_status = oa.get("oa_status")
    oa_url = oa.get("oa_url")

    doi = w.get("doi")
    if doi and doi.startswith("https://doi.org/"):
        doi = doi[len("https://doi.org/"):]

    work_type = _resolve_work_type(w.get("type"), source, doi)
    src_type = (source.get("type") or "").strip().lower() or None
    journal_article = _is_journal_article(work_type, source)
    quartile = None
    matched_issn = None
    if journal_article:
        quartile, matched_issn = _best_quartile_from_issns(_issn_candidates_from_source(source))
    if not issn_l and matched_issn:
        issn_l = matched_issn

    return WorkResult(
        openalex_id=_clean_id(w.get("id")),
        title=w.get("display_name") or w.get("title") or "(sin título)",
        year=w.get("publication_year"),
        doi=doi,
        type=work_type,
        cited_by_count=w.get("cited_by_count") or 0,
        fwci=w.get("fwci"),
        is_oa=is_oa,
        oa_status=oa_status,
        oa_url=oa_url,
        journal=journal,
        publisher=publisher,
        field=field,
        issn_l=issn_l,
        quartile=quartile,
        abstract=_reconstruct_abstract(w.get("abstract_inverted_index")),
        authors=authors,
        source_type=src_type,
        is_journal_article=journal_article,
    )


# ----------------------------------------------------------------------
# Construcción de filtros compartida por /search y /facets
# ----------------------------------------------------------------------
def build_filters(
    year_from: Optional[int],
    year_to: Optional[int],
    open_access: Optional[bool],
    work_type: Optional[str],
    oa_status: Optional[str],
    field: Optional[str],
    publisher: Optional[str],
    repository: Optional[str],
    dataset_repository: Optional[str],
    fwci_min: Optional[float],
) -> list[str]:
    filters = []
    if year_from and year_to:
        filters.append(f"publication_year:{year_from}-{year_to}")
    elif year_from:
        filters.append(f"publication_year:{year_from}-2100")
    elif year_to:
        filters.append(f"publication_year:1800-{year_to}")
    if open_access is True:
        filters.append("is_oa:true")
    pub_id = _normalize_openalex_entity_id(publisher)
    repo_id = _normalize_openalex_entity_id(repository)
    ds_repo_id = _normalize_openalex_entity_id(dataset_repository)
    if work_type and not ds_repo_id and not (repo_id and work_type == "dataset"):
        types = [t.strip() for t in work_type.split("|") if t.strip()]
        if types == ["book-chapter"]:
            filters.append("type:book-chapter|article|review|letter|editorial")
            filters.append("primary_location.source.type:book|ebook")
        elif types == ["book"]:
            filters.append("type:book")
        elif types and all(t in JOURNAL_WORK_TYPES or t == "preprint" for t in types):
            filters.append(f"type:{work_type}")
            filters.append("primary_location.source.type:!book,!ebook")
        else:
            filters.append(f"type:{work_type}")
    if oa_status:
        filters.append(f"open_access.oa_status:{oa_status}")
    field_id = _normalize_field_id(field)
    if field_id:
        filters.append(f"primary_topic.field.id:{field_id}")
    if ds_repo_id:
        filters.append(f"primary_location.source.host_organization:{ds_repo_id}")
        filters.append("type:dataset")
    elif repo_id:
        filters.append(f"primary_location.source.host_organization:{repo_id}")
        filters.append("type:!dataset")
    elif pub_id:
        filters.append(f"primary_location.source.host_organization:{pub_id}")
    if fwci_min:
        filters.append(f"fwci:>{fwci_min}")
    return filters


async def _openalex_get(client: httpx.AsyncClient, url: str, params: dict) -> dict:
    resp = await client.get(url, params=params)
    if resp.status_code == 429:
        raise HTTPException(status_code=429, detail="Límite de OpenAlex alcanzado.")
    if resp.status_code == 403:
        raise HTTPException(status_code=403, detail="API key inválida o sin saldo.")
    if resp.status_code == 400:
        hint = ""
        try:
            body = resp.json()
            hint = body.get("message") or body.get("error") or ""
        except Exception:
            pass
        raise HTTPException(
            status_code=502,
            detail=(
                "Parámetros de búsqueda no válidos para OpenAlex."
                + (f" {hint}" if hint else " Revisa filtros activos (editorial, cuartil, etc.).")
            ),
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"OpenAlex devolvió {resp.status_code}.")
    return resp.json()


async def _try_openalex_get(
    client: httpx.AsyncClient, url: str, params: dict,
) -> Optional[dict]:
    """Como _openalex_get pero devuelve None ante 400 (filtro demasiado largo o inválido)."""
    try:
        return await _openalex_get(client, url, params)
    except HTTPException as exc:
        if exc.status_code == 502 and "no válidos" in str(exc.detail):
            return None
        raise


async def _fetch_oa_works(
    client: httpx.AsyncClient,
    q: str,
    filters: list[str],
    sort: str,
    page: int,
    per_page: int,
) -> dict:
    sort_map = {
        "relevance": "relevance_score:desc",
        "citations": "cited_by_count:desc",
        "date": "publication_date:desc",
        "date_asc": "publication_date:asc",
    }
    params = {
        "search": q,
        "page": page,
        "per-page": per_page,
        "sort": sort_map[sort],
        "api_key": OPENALEX_API_KEY,
        "select": SELECT_FIELDS,
    }
    if filters:
        params["filter"] = ",".join(filters)
    if CONTACT_EMAIL:
        params["mailto"] = CONTACT_EMAIL
    return await _openalex_get(client, f"{OPENALEX_BASE}/works", params)


async def _try_fetch_oa_works(
    client: httpx.AsyncClient,
    q: str,
    filters: list[str],
    sort: str,
    page: int,
    per_page: int,
) -> Optional[dict]:
    """Igual que _fetch_oa_works pero None si OpenAlex rechaza el filtro (400)."""
    sort_map = {
        "relevance": "relevance_score:desc",
        "citations": "cited_by_count:desc",
        "date": "publication_date:desc",
        "date_asc": "publication_date:asc",
    }
    params = {
        "search": q,
        "page": page,
        "per-page": per_page,
        "sort": sort_map[sort],
        "api_key": OPENALEX_API_KEY,
        "select": SELECT_FIELDS,
    }
    if filters:
        params["filter"] = ",".join(filters)
    if CONTACT_EMAIL:
        params["mailto"] = CONTACT_EMAIL
    return await _try_openalex_get(client, f"{OPENALEX_BASE}/works", params)


async def _issns_for_quartile_in_query(
    client: httpx.AsyncClient,
    q: str,
    filters: list[str],
    quartile: str,
    max_issns: int | None = None,
) -> list[str]:
    """ISSN del cuartil en la búsqueda + completado desde la KB SJR (hasta max_issns)."""
    limit = max_issns if max_issns is not None else QUARTILE_FILTER_MAX_ISSNS
    try:
        issn_groups, _ = await _group_by(
            client, q, filters, "primary_location.source.issn", 200,
        )
    except HTTPException:
        issn_groups = []
    sjr = _load_sjr_map()
    seen: set[str] = set()
    out: list[str] = []

    def _add(raw: str) -> None:
        if len(out) >= limit:
            return
        norm = _norm_issn(raw)
        if not norm or norm in seen:
            return
        seen.add(norm)
        # OpenAlex acepta ISSN con guión en el filtro group_by
        out.append(raw.strip() if "-" in raw else norm)

    for b in issn_groups:
        key = str(b.get("key") or "").strip()
        norm = _norm_issn(key)
        if norm and sjr.get(norm) == quartile:
            _add(key)
        if len(out) >= limit:
            return out

    for issn in _kb_issns_for_quartile(quartile):
        _add(issn)
        if len(out) >= limit:
            break

    return out


async def _search_with_quartile(
    client: httpx.AsyncClient,
    q: str,
    filters: list[str],
    sort: str,
    quartile: str,
    page: int,
    per_page: int,
) -> tuple[list[WorkResult], int, float]:
    """Filtra por cuartil SJR cruzando ISSN OpenAlex con la KB Scimago."""
    issns = _trim_issns_for_oa_filter(
        await _issns_for_quartile_in_query(client, q, filters, quartile),
    )
    cost = 0.0

    if issns:
        q_filters = filters + [f"primary_location.source.issn:{'|'.join(issns)}"]
        data = await _try_fetch_oa_works(client, q, q_filters, sort, page, per_page)
        if data:
            meta = data.get("meta") or {}
            cost = float(meta.get("cost_usd", 0.0) or 0.0)
            results: list[WorkResult] = []
            for w in data.get("results") or []:
                wr = normalize_work(w)
                if wr.type != "dataset" and wr.is_journal_article and wr.quartile == quartile:
                    results.append(wr)
            if results:
                return results, int(meta.get("count", len(results))), cost

    # Respaldo: barrido paginado (filtro ISSN vacío, rechazado o sin coincidencias)
    need_end = page * per_page
    matched: list[WorkResult] = []
    oa_page = 1
    oa_per_page = 50

    while len(matched) < need_end and oa_page <= QUARTILE_MAX_OA_PAGES:
        data = await _try_fetch_oa_works(client, q, filters, sort, oa_page, oa_per_page)
        if not data:
            break
        batch = data.get("results") or []
        if not batch:
            break
        for w in batch:
            wr = normalize_work(w)
            if wr.type != "dataset" and wr.is_journal_article and wr.quartile == quartile:
                matched.append(wr)
        oa_page += 1

    start = (page - 1) * per_page
    return matched[start:start + per_page], len(matched), 0.0


# ----------------------------------------------------------------------
# Endpoint principal de búsqueda
# ----------------------------------------------------------------------
@app.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=2),
    page: int = Query(1, ge=1, le=200),
    per_page: int = Query(25, ge=1, le=50),
    year_from: Optional[int] = Query(None, ge=1800),
    year_to: Optional[int] = Query(None, le=2100),
    open_access: Optional[bool] = Query(None),
    type: Optional[str] = Query(None),
    oa_status: Optional[str] = Query(None),
    field: Optional[str] = Query(None),
    publisher: Optional[str] = Query(None),
    repository: Optional[str] = Query(None),
    dataset_repository: Optional[str] = Query(None),
    fwci_min: Optional[float] = Query(None, ge=0),
    quartile: Optional[str] = Query(None, pattern="^Q[1-4]$"),
    sort: str = Query("relevance", pattern="^(relevance|citations|date|date_asc)$"),
):
    if not OPENALEX_API_KEY:
        raise HTTPException(status_code=500, detail="Sin OPENALEX_API_KEY.")

    cache_key = hashlib.sha256(
        f"search|{q}|{page}|{per_page}|{year_from}|{year_to}|{open_access}|"
        f"{type}|{oa_status}|{field}|{publisher}|{repository}|{dataset_repository}|{fwci_min}|{quartile}|{sort}".encode()
    ).hexdigest()

    cached = _cache_get(cache_key)
    if cached:
        return {**cached, "cached": True}

    filters = build_filters(year_from, year_to, open_access, type, oa_status,
                            field, publisher, repository, dataset_repository, fwci_min)

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            if quartile:
                results, filtered_total, q_cost = await _search_with_quartile(
                    client, q, filters, sort, quartile, page, per_page,
                )
                meta_cost = q_cost
                total = filtered_total
            else:
                data = await _fetch_oa_works(client, q, filters, sort, page, per_page)
                meta = data.get("meta") or {}
                results = [normalize_work(w) for w in (data.get("results") or [])]
                meta_cost = float(meta.get("cost_usd", 0.0) or 0.0)
                total = meta.get("count", 0)
            await _enrich_linked_datasets(client, results)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Error al contactar OpenAlex: {e}")

    payload = SearchResponse(
        query=q,
        total=total,
        page=page,
        per_page=per_page,
        cost_usd=meta_cost if not quartile else 0.0,
        cached=False,
        results=results,
    ).model_dump()

    _cache_set(cache_key, payload)
    return payload


# ----------------------------------------------------------------------
# Endpoint de facetas (conteos vía group_by)
# ----------------------------------------------------------------------
FIELD_NAMES = {
    "17": "Informática", "27": "Medicina", "11": "Agricultura y biología",
    "13": "Bioquímica y genética", "12": "Artes y humanidades",
    "33": "Ciencias sociales", "31": "Física y astronomía",
    "22": "Ingeniería", "16": "Química", "25": "Ciencias de materiales",
    "23": "Ciencias ambientales", "19": "Ciencias de la Tierra",
    "28": "Neurociencia", "24": "Inmunología y microbiología",
    "36": "Salud pública", "35": "Enfermería", "32": "Psicología",
}
TYPE_LABELS = {
    "article": "Artículo", "book": "Libro", "book-chapter": "Capítulo",
    "review": "Review", "dataset": "Dataset", "preprint": "Preprint",
    "dissertation": "Tesis", "report": "Informe",
}
OA_LABELS = {
    "gold": "Oro", "green": "Verde", "hybrid": "Híbrido",
    "bronze": "Bronce", "closed": "Cerrado", "diamond": "Diamante",
}


async def _group_by(client, q, filters, group_field, group_limit: int = 25):
    # Con group_by, per-page controla CUÁNTOS GRUPOS devuelve la API (máx 200),
    # no cuántas obras. OpenAlex ordena los grupos por key (alfabético), así que
    # los ordenamos por count en el proxy para quedarnos con los más frecuentes.
    params = {
        "search": q,
        "group_by": group_field,
        "api_key": OPENALEX_API_KEY,
        "per-page": min(max(group_limit, 1), 200),
    }
    if filters:
        params["filter"] = ",".join(filters)
    if CONTACT_EMAIL:
        params["mailto"] = CONTACT_EMAIL
    data = await _openalex_get(client, f"{OPENALEX_BASE}/works", params)
    cost = float((data.get("meta") or {}).get("cost_usd", 0.0) or 0.0)
    groups = data.get("group_by") or []
    groups.sort(key=lambda g: g.get("count", 0), reverse=True)
    return groups, cost


@app.get("/facets", response_model=FacetsResponse)
async def facets(
    q: str = Query(..., min_length=2),
    year_from: Optional[int] = Query(None, ge=1800),
    year_to: Optional[int] = Query(None, le=2100),
):
    if not OPENALEX_API_KEY:
        raise HTTPException(status_code=500, detail="Sin OPENALEX_API_KEY.")

    cache_key = hashlib.sha256(
        f"facets|{q}|{year_from}|{year_to}".encode()
    ).hexdigest()
    cached = _cache_get(cache_key)
    if cached:
        return {**cached, "cached": True}

    base_filters = build_filters(year_from, year_to, None, None, None, None, None, None, None, None)
    repo_filters = base_filters + ["type:!dataset"]
    dataset_repo_filters = base_filters + ["type:dataset"]

    async with httpx.AsyncClient(timeout=45.0) as client:
        # OpenAlex no permite varios group_by por llamada → una por faceta.
        # Cuartil SJR: group_by ISSN + cruce con mapa Scimago local.
        results = await asyncio.gather(
            _group_by(client, q, base_filters, "type"),
            _group_by(client, q, base_filters, "open_access.oa_status"),
            _group_by(client, q, base_filters, "primary_topic.field.id"),
            _group_by(client, q, base_filters, "primary_location.source.host_organization", 100),
            _group_by(client, q, repo_filters, "primary_location.source.host_organization", 50),
            _group_by(client, q, dataset_repo_filters, "primary_location.source.host_organization", 50),
            _group_by(client, q, base_filters, "primary_location.source.issn", 200),
        )

    (types_raw, c1), (oa_raw, c2), (fields_raw, c3), (pubs_raw, c4), \
        (repos_raw, c5), (ds_repos_raw, c6), (issn_raw, c7) = results
    total_cost = c1 + c2 + c3 + c4 + c5 + c6 + c7
    quartiles = _aggregate_quartile_buckets(issn_raw)

    def buckets(raw, label_map=None, name_from_key=False, limit=12):
        out = []
        for b in raw[:limit]:
            raw_key = str(b.get("key"))
            # OpenAlex devuelve claves como URL ("https://openalex.org/types/article").
            # Extraemos el segmento final para el lookup Y para devolver al frontend.
            short_key = raw_key.rsplit("/", 1)[-1]
            if label_map:
                label = label_map.get(short_key, b.get("key_display_name") or short_key)
            elif name_from_key:
                label = FIELD_NAMES.get(short_key, b.get("key_display_name") or short_key)
            else:
                label = b.get("key_display_name") or short_key
            out.append(FacetBucket(key=short_key, label=label, count=b.get("count", 0)))
        return out

    def host_org_buckets(raw, kind: str, limit: int = 50):
        """Separa editoriales (P…) de repositorios institucionales (I…)."""
        out = []
        for b in raw:
            if len(out) >= limit:
                break
            raw_key = str(b.get("key"))
            short_key = raw_key.rsplit("/", 1)[-1]
            prefix = short_key[:1].upper()
            if kind == "publisher" and prefix != "P":
                continue
            if kind == "repository" and prefix != "I":
                continue
            label = _sanitize_display_label(b.get("key_display_name") or "")
            if not label:
                continue
            out.append(FacetBucket(key=short_key, label=label, count=b.get("count", 0)))
        return out

    def dataset_repo_buckets(raw, limit: int = 50):
        """Repositorios de datasets (Figshare, Zenodo, etc.) en la búsqueda."""
        out = []
        for b in raw:
            if len(out) >= limit:
                break
            raw_key = str(b.get("key"))
            short_key = raw_key.rsplit("/", 1)[-1]
            label = _sanitize_display_label(b.get("key_display_name") or "")
            if not label:
                continue
            out.append(FacetBucket(key=short_key, label=label, count=b.get("count", 0)))
        return out

    payload = FacetsResponse(
        query=q,
        cached=False,
        cost_usd=total_cost,
        types=buckets(types_raw, TYPE_LABELS),
        oa_status=buckets(oa_raw, OA_LABELS),
        fields=buckets(fields_raw, name_from_key=True),
        publishers=host_org_buckets(pubs_raw, "publisher", limit=50),
        repositories=host_org_buckets(repos_raw, "repository", limit=50),
        dataset_repositories=dataset_repo_buckets(ds_repos_raw, limit=50),
        quartiles=quartiles,
    ).model_dump()

    _cache_set(cache_key, payload)
    return payload


# ----------------------------------------------------------------------
# Salud y uso
# ----------------------------------------------------------------------
@app.get("/health")
async def health():
    sjr = _load_sjr_map()
    return {
        "status": "ok",
        "has_key": bool(OPENALEX_API_KEY),
        "sjr_map_loaded": len(sjr),
        "sjr_map_path": str(SJR_MAP_PATH),
    }


@app.get("/usage")
async def usage():
    if not OPENALEX_API_KEY:
        raise HTTPException(status_code=500, detail="Sin OPENALEX_API_KEY.")
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{OPENALEX_BASE}/rate-limit",
                                params={"api_key": OPENALEX_API_KEY})
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="No se pudo consultar el uso.")
    return resp.json()
