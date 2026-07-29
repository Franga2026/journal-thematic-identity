# -*- coding: utf-8 -*-
"""
Prueba B — Robustez taxonómica de la representación observada (subfield → field)
================================================================================
Computa B1 (dominante), B2 (núcleo por roll-up) y B3 (forma ordinal) contra los
umbrales PRE-REGISTRADOS en docs/paper2/preregistro_pruebaB.md. NO re-extrae: el
perfil a nivel field es la agregación del perfil de subfields de W0.

Único insumo extra: el mapa subfield → field (jerarquía OpenAlex). Dos modos:
  MAP_MODE='table'   → tabla subfield_field_map(subfield_id, field_id)
  MAP_MODE='prefix2' → field = 2 primeros dígitos del código ASJC (fallback;
                        imprime aviso — verificar que aplica a tu esquema)

pip install --break-system-packages psycopg[binary] pandas numpy scipy
"""
import sys
import numpy as np
import pandas as pd

# ------------------------------------------------------------------ CONFIG ---
import os
DSN = os.getenv("CRIS_DB_DSN")
if not DSN:
    raise RuntimeError(
        "CRIS_DB_DSN is not set. Provide a PostgreSQL DSN through the environment."
    )
PROFILE_TABLE = "journal_identity_profile"
W0 = "W0_2021_2024"                 # ajustar al label real de la ventana base
MAP_MODE = "table"                  # 'table' | 'prefix2'  (preferir table desde openalex_topics)
MAP_TABLE = "subfield_field_map"    # usado si MAP_MODE='table' (cols: subfield_id, field_id)
TAU = 0.50                          # masa acumulada del núcleo
TIE_EPS = 1e-9                      # empate "real" en el dominante

# Umbrales PRE-REGISTRADOS (preregistro_pruebaB.md) — no tocar sin enmienda fechada
TH_B1_OK, TH_B1_FAIL = 0.90, 0.80
TH_B2_MED_OK, TH_B2_TAIL_FRAC, TH_B2_TAIL_MIN, TH_B2_MED_FAIL = 0.85, 0.80, 0.70, 0.70
TH_B3_OK, TH_B3_FAIL = 0.90, 0.80   # ← B3: 0.90 (=A). Cambiar a 0.85 = enmienda fechada.
ENTROPY_FOR_VERDICT = "H_norm"      # 'H_norm' (= descriptor pre-registrado de A) | 'H_raw'


def get_conn():
    try:
        import psycopg
        return psycopg.connect(DSN)
    except Exception:
        import psycopg2
        return psycopg2.connect(DSN)


def ensure_map_from_openalex(conn) -> int:
    """Crea/actualiza subfield_field_map desde openalex_topics (IDs sin prefijo)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS subfield_field_map (
                subfield_id text PRIMARY KEY,
                field_id    text NOT NULL
            );
            INSERT INTO subfield_field_map (subfield_id, field_id)
            SELECT DISTINCT
                regexp_replace(subfield_id, '.*/', '') AS subfield_id,
                regexp_replace(field_id, '.*/', '') AS field_id
            FROM openalex_topics
            WHERE subfield_id IS NOT NULL AND field_id IS NOT NULL
            ON CONFLICT (subfield_id) DO UPDATE SET field_id = EXCLUDED.field_id;
            """
        )
        cur.execute("SELECT COUNT(*) FROM subfield_field_map")
        n = cur.fetchone()[0]
    conn.commit()
    return int(n)


def load_profile():
    q = f"""SELECT source_id, subfield_id AS sub, p_cit
            FROM {PROFILE_TABLE} WHERE config = '{W0}'"""
    with get_conn() as c:
        return pd.read_sql(q, c)


def load_map(subs):
    if MAP_MODE == "table":
        with get_conn() as c:
            ensure_map_from_openalex(c)
            m = pd.read_sql(
                f"SELECT subfield_id::text AS sub, field_id::text AS field FROM {MAP_TABLE}",
                c,
            )
        return dict(zip(m["sub"], m["field"]))
    # fallback prefix2 (convención ASJC: field = 2 primeros dígitos)
    print("[AVISO] MAP_MODE='prefix2': field = 2 primeros dígitos del subfield_id. "
          "Verificá que aplica a tu esquema; si no, usá MAP_MODE='table'.")
    return {s: str(s)[:2] for s in subs}


# ---- métricas ----
def core_keys(dist, tau=TAU):
    s = sorted(dist.items(), key=lambda kv: -kv[1])
    acc, out = 0.0, []
    for k, v in s:
        out.append(k)
        acc += v
        if acc >= tau:
            break
    return set(out)


def top_tie(dist):
    """(argmax, hay_empate_real)"""
    s = sorted(dist.values(), reverse=True)
    tie = len(s) >= 2 and abs(s[0] - s[1]) <= TIE_EPS
    arg = max(dist.items(), key=lambda kv: kv[1])[0]
    return arg, tie


def hhi(d):
    return float(sum(v * v for v in d.values()))


def H_raw(d):
    ps = np.array([v for v in d.values() if v > 0], float)
    return float(-np.sum(ps * np.log(ps))) if len(ps) else 0.0


def H_norm(d):
    ps = np.array([v for v in d.values() if v > 0], float)
    return float(-np.sum(ps * np.log(ps)) / np.log(len(ps))) if len(ps) > 1 else 0.0


def field_dist(sub_dist, s2f):
    fd = {}
    for s, p in sub_dist.items():
        f = s2f.get(s)
        if f is None:  # subfield sin field mapeado
            continue
        fd[f] = fd.get(f, 0.0) + p
    tot = sum(fd.values())
    return {f: p / tot for f, p in fd.items()} if tot > 0 else {}


def main():
    from scipy.stats import spearmanr
    df = load_profile()
    subs = sorted(df["sub"].astype(str).unique())
    s2f = load_map(subs)
    prof = {sid: dict(zip(g["sub"].astype(str), g["p_cit"].astype(float)))
            for sid, g in df.groupby("source_id")}
    n_total = len(prof)
    rows, unmapped = [], 0
    for sid, sd in prof.items():
        fd = field_dist(sd, s2f)
        if not fd:
            unmapped += 1
            continue
        sub_dom, sub_tie = top_tie(sd)
        fld_dom, fld_tie = top_tie(fd)
        indet = sub_tie or fld_tie
        parent = s2f.get(sub_dom)
        match = int(parent == fld_dom) if parent is not None else 0
        # B2 roll-up
        R = {s2f.get(s) for s in core_keys(sd)} - {None}
        F = core_keys(fd)
        jacc = len(R & F) / len(R | F) if (R | F) else np.nan
        rows.append(dict(sid=sid, indet=indet, match=match, jacc=jacc,
                         tci_s=hhi(sd), tci_f=hhi(fd),
                         hr_s=H_raw(sd), hr_f=H_raw(fd),
                         hn_s=H_norm(sd), hn_f=H_norm(fd)))
    r = pd.DataFrame(rows)
    print(f"\n[datos] revistas={n_total}  sin field mapeado={unmapped}  "
          f"indeterminadas (empate dominante)={int(r['indet'].sum())}")
    print(f"[mapa] MAP_MODE={MAP_MODE}  entradas cargadas={len(s2f)}")

    # --- B1 ---
    main_r = r[~r["indet"]]
    b1_main = float(main_r["match"].mean())
    b1_cons = float(r["match"].mean())  # conservador: empate = no coincidencia

    def tier(x, ok, fail):
        return "ÉXITO" if x >= ok else ("FRACASO" if x < fail else "ZONA GRIS")

    print("\n=== B1 · estructura dominante ===")
    print(f"  coincidencia (excl. indeterminadas, n={len(main_r)}) = {b1_main:.3f} → {tier(b1_main, TH_B1_OK, TH_B1_FAIL)}")
    print(f"  variante conservadora (empate=no match)            = {b1_cons:.3f} → {tier(b1_cons, TH_B1_OK, TH_B1_FAIL)}")

    # --- B2 ---
    med_j = float(r["jacc"].median())
    frac70 = float((r["jacc"] >= TH_B2_TAIL_MIN).mean())
    b2_ok = (med_j >= TH_B2_MED_OK) and (frac70 >= TH_B2_TAIL_FRAC)
    b2 = "ÉXITO" if b2_ok else ("FRACASO" if med_j < TH_B2_MED_FAIL else "ZONA GRIS")
    print("\n=== B2 · núcleo por roll-up (Jaccard) ===")
    print(f"  mediana J = {med_j:.3f}  · % con J≥{TH_B2_TAIL_MIN:.2f} = {frac70:.1%}  → {b2}")

    # --- B3 ---
    def sp(a, b):
        m = r[a].notna() & r[b].notna()
        return float(spearmanr(r[a][m], r[b][m])[0])

    rho_tci = sp("tci_s", "tci_f")
    rho_hr = sp("hr_s", "hr_f")
    rho_hn = sp("hn_s", "hn_f")
    print("\n=== B3 · preservación ordinal de la forma (Spearman entre niveles) ===")
    print(f"  TCI      ρ={rho_tci:.3f} → {tier(rho_tci, TH_B3_OK, TH_B3_FAIL)}")
    print(f"  H_norm   ρ={rho_hn:.3f} → {tier(rho_hn, TH_B3_OK, TH_B3_FAIL)}")
    print(f"  H_raw    ρ={rho_hr:.3f} (referencia)")

    # --- veredictos ---
    b1_tier = tier(b1_main, TH_B1_OK, TH_B1_FAIL)
    if b1_tier == "ÉXITO" and b2 == "ÉXITO":
        struct = "ÉXITO"
    elif "FRACASO" in (b1_tier, b2):
        struct = "FRACASO"
    else:
        struct = "ÉXITO PARCIAL"
    rho_form = rho_hn if ENTROPY_FOR_VERDICT == "H_norm" else rho_hr
    form_tci = tier(rho_tci, TH_B3_OK, TH_B3_FAIL)
    form_h = tier(rho_form, TH_B3_OK, TH_B3_FAIL)
    print("\n=== VEREDICTOS (pre-registrados, separados) ===")
    print(f"  ESTRUCTURAL: {struct}")
    print(f"  FORMA · TCI: {form_tci}   FORMA · entropía ({ENTROPY_FOR_VERDICT}): {form_h}")

    # --- regla de la hipótesis estructura/dinámica ---
    struct_ok = struct in ("ÉXITO", "ÉXITO PARCIAL")
    form_lower = (form_tci != "ÉXITO") or (form_h != "ÉXITO")
    if struct == "ÉXITO" and form_lower:
        verdict = "APOYO CONVERGENTE a estructura≠dinámica (estructura alta, forma inferior)"
    elif struct_ok and not form_lower:
        verdict = "SIN APOYO (estructura y forma comparables)"
    elif struct == "FRACASO":
        verdict = "estructura NO preservada — revisar (posible refutación si forma > estructura)"
    else:
        verdict = "mixto — reportar tal cual"
    print(f"\n  Hipótesis estructura/dinámica: {verdict}")
    print("  (Junto con la Prueba A temporal: si hay apoyo, la distinción pasa a rasgo del marco.)")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("ERROR:", e, file=sys.stderr)
        print("Revisá CONFIG (W0, MAP_MODE/MAP_TABLE) y que W0 esté poblado.", file=sys.stderr)
        raise
