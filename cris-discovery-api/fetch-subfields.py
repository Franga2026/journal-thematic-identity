"""
Trae los 254 subcampos de OpenAlex y los añade a openalex-taxonomy.json.
Ejecutar desde tu máquina (donde OpenAlex responde sin rate limit):
    python3 fetch-subfields.py
"""
import requests, json, time

MAILTO = "soporte@rosflo.com"

def get(url, retries=5):
    for attempt in range(retries):
        r = requests.get(url, timeout=30)
        if r.status_code == 429:
            time.sleep(5 * (attempt+1)); continue
        r.raise_for_status()
        return r.json()
    return {}

# Traer subcampos (paginado, ~254)
subfields = {}
cursor = "*"
while cursor:
    data = get(f"https://api.openalex.org/subfields?per-page=200&cursor={cursor}&mailto={MAILTO}")
    for s in data.get("results", []):
        sid = s["id"].rsplit("/",1)[-1]
        field = s.get("field", {})
        fid = field.get("id","").rsplit("/",1)[-1] if field.get("id") else None
        subfields[sid] = {
            "name_en": s["display_name"],
            "field_id": fid,
            "field_name": field.get("display_name"),
        }
    cursor = data.get("meta", {}).get("next_cursor")
    time.sleep(0.3)

print(f"Subcampos traídos: {len(subfields)}")

# Fusionar con la taxonomía existente
with open('openalex-taxonomy.json') as f:
    tax = json.load(f)

tax["subfields"] = subfields

with open('openalex-taxonomy.json','w') as f:
    json.dump(tax, f, ensure_ascii=False, indent=2)

print("Añadidos a openalex-taxonomy.json")
