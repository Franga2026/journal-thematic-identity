"""Build a minimal OpenAlex-like WORKS pyarrow table for tests."""

from __future__ import annotations

from typing import Any

import pyarrow as pa


def make_works_table(rows: list[dict[str, Any]]) -> pa.Table:
    """rows keys: id, publication_year, source_id?, type?, language?, cited?, refs?, abstract?, topics?, counts?"""
    ids = []
    years = []
    primary_locations = []
    primary_topics = []
    topics = []
    types = []
    langs = []
    cited = []
    refs = []
    abstracts = []
    counts = []
    for r in rows:
        ids.append(r["id"])
        years.append(int(r["publication_year"]))
        sid = r.get("source_id")
        primary_locations.append(
            {"source": {"id": sid}} if sid else {"source": None}
        )
        tid = r.get("primary_topic_id")
        sfid = r.get("primary_subfield_id")
        if tid:
            primary_topics.append(
                {
                    "id": tid,
                    "display_name": "t",
                    "score": 0.9,
                    "subfield": {"id": sfid, "display_name": "s"} if sfid else None,
                    "field": None,
                    "domain": None,
                }
            )
        else:
            primary_topics.append(None)
        tlist = []
        for a in r.get("topic_assignments") or []:
            tlist.append(
                {
                    "id": a["topic_id"],
                    "display_name": "x",
                    "score": float(a.get("score", 0.1)),
                    "subfield": {
                        "id": a.get("subfield_id") or sfid or "https://openalex.org/subfields/1",
                        "display_name": "s",
                    },
                    "field": None,
                    "domain": None,
                }
            )
        topics.append(tlist)
        types.append(r.get("type", "article"))
        langs.append(r.get("language", "en"))
        cited.append(int(r.get("cited_by_count", 0)))
        refs.append(int(r.get("referenced_works_count", 0)))
        abstracts.append(r.get("abstract_inverted_index"))
        counts.append(r.get("counts_by_year") or [])

    return pa.table(
        {
            "id": pa.array(ids, type=pa.string()),
            "publication_year": pa.array(years, type=pa.int32()),
            "primary_location": primary_locations,
            "primary_topic": primary_topics,
            "topics": topics,
            "type": pa.array(types, type=pa.string()),
            "language": pa.array(langs, type=pa.string()),
            "cited_by_count": pa.array(cited, type=pa.int32()),
            "referenced_works_count": pa.array(refs, type=pa.int32()),
            "abstract_inverted_index": pa.array(abstracts, type=pa.string()),
            "counts_by_year": counts,
        }
    )
