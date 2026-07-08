# Repositorio ANID — OAI-PMH y registros UTA

Referencia para consultar el repositorio institucional de ANID (DSpace 7.5) vía OAI-PMH o API REST, y para estimar cuántos registros corresponden a la **Universidad de Tarapacá (UTA)**.

**Última verificación:** 2026-07-06.

---

## URLs: cuál usar y cuál no

| URL | Resultado |
|-----|-----------|
| `https://repositorio.anid.cl/oai/request` | **HTML** del SPA Angular (Amazon S3/CloudFront). No expone OAI. |
| `https://repositorio.be-anid.com/server/oai/request` | **XML OAI-PMH** (endpoint real). |
| `https://repositorio.be-anid.com/server/api` | API REST DSpace (JSON). |

El frontend público (`repositorio.anid.cl`) es estático. El backend DSpace está en `repositorio.be-anid.com`. La configuración del SPA lo confirma en:

```bash
curl -s "https://repositorio.anid.cl/assets/config.json" | jq '.rest'
# → baseUrl: https://repositorio.be-anid.com/server
```

### Identificación del repositorio

```bash
curl -s "https://repositorio.be-anid.com/server/oai/request?verb=Identify"
```

| Campo | Valor |
|-------|-------|
| Plataforma | **DSpace 7.5** (`GET /server/api` → `dspaceVersion`) |
| Nombre | Repositorio ANID |
| OAI baseURL | `https://repositorio.be-anid.com/server/oai/request` |
| Identificador OAI | `oai:repositorio.anid.cl:10533/{id}` |
| Handle prefix | `10533` |
| Primer registro | `2016-07-19T22:52:30Z` |
| Sets totales (ListSets) | **1.155** (paginado, 100 por página) |

---

## Comandos OAI útiles

Base (usar siempre el backend):

```bash
OAI="https://repositorio.be-anid.com/server/oai/request"

# Identify
curl -s "$OAI?verb=Identify"

# Comunidades y colecciones (sets)
curl -s "$OAI?verb=ListSets"

# Siguiente página de sets
curl -s "$OAI?verb=ListSets&resumptionToken=////100"

# Registros Dublin Core (paginado)
curl -s "$OAI?verb=ListRecords&metadataPrefix=oai_dc" | head -150

# Registros de un set concreto (ej. FONDECYT)
curl -s "$OAI?verb=ListRecords&metadataPrefix=oai_dc&set=com_10533_29974"
```

### Formato de `setSpec`

- `com_10533_{id}` — **comunidad** (programa, p. ej. FONDECYT).
- `col_10533_{id}` — **colección** (concurso, tesis, informes, etc.).

El `{id}` coincide con el segmento numérico del handle DSpace (`10533/30152` → `col_10533_30152`).

Un mismo ítem aparece en **varios** `setSpec` (jerarquía comunidad → subcomunidad → colección).

### Ejemplo de registro Dublin Core

Campos habituales en metadatos ANID:

- `dc:creator` — autor(es)
- `dc:contributor` — institución del investigador (en proyectos FONDECYT)
- `dc:contributor` / `dc.contributor.institution` / `dc.contributor.corporatename` — afiliación
- `dc:type` — tipo local + vocabulario `info:eu-repo/semantics/*`
- `dc:identifier` — folio ANID, handle (`https://hdl.handle.net/10533/...`), WOS, etc.
- `dc:relation` — DOI, grants (`grantAgreement/Fondecyt/...`), handles de programa/instrumento/concurso
- `setSpec` en el `<header>` — pertenencia a comunidades y colecciones

---

## API REST (alternativa más rápida para conteos)

```bash
API="https://repositorio.be-anid.com/server/api/discover/search/objects"

# Total del repositorio
curl -s "$API?size=0" | jq '._embedded.searchResult.page.totalElements'

# Registros con afiliación UTA (ver criterio abajo)
Q='dc.contributor.institution:*Tarapac*+OR+dc.contributor.corporatename:*Tarapac*+OR+datacite.contributor:*TARAPAC*'
curl -s "$API?query=$Q&size=0" | jq '._embedded.searchResult.page.totalElements'
```

Filtros por programa o tipo de entidad:

```bash
# Solo FONDECYT con afiliación UTA
curl -s "$API?query=$Q&f.programa=FONDECYT,equals&size=0"

# Solo tesis UTA
curl -s "$API?query=$Q&f.entityType=Tesis,equals&size=0"
```

Facets disponibles: `programa`, `entityType`, `itemoecdtype`, `author`, `dateIssued`.

---

## Registros de la Universidad de Tarapacá

### Criterios de conteo

| Criterio | Registros | Notas |
|----------|-----------|-------|
| **Afiliación explícita UTA** | **772** | Campos `dc.contributor.institution`, `dc.contributor.corporatename` o `datacite.contributor` contienen *Tarapac* / *TARAPAC*. |
| Mención texto libre | 2.580 | Búsqueda `Universidad de Tarapaca` en todo el índice; incluye región, títulos, etc. |
| Repositorio completo | ~186.986 | Referencia 2026-07-06. |

**Usar siempre el criterio de afiliación explícita** para atribución institucional. El criterio de texto libre sobrestima (menciones geográficas, colaboraciones, etc.).

### Por tipo de entidad DSpace (1 ítem = 1 colección `col_*`)

| Registros | Tipo | Colección OAI típica |
|-----------|------|----------------------|
| 577 | Proyecto | Concursos por año (`col_10533_*`, muchas colecciones) |
| 118 | Tesis | `col_10533_30152` (Tesis) |
| 76 | InformeFinal | `col_10533_30144` (Informes Finales) |
| 1 | Patente | `col_10533_30149` (Patentes) |

Los **577 proyectos** se reparten en **~63 colecciones-concurso** (`dc.relation.contest`); ninguna supera ~13 registros UTA.

### Por programa / comunidad OAI (`com_*`)

Un ítem puede etiquetarse en varios programas; **la suma por programa puede superar 772**.

| Registros | Programa | `setSpec` |
|-----------|----------|-----------|
| 214 | FONDECYT | `com_10533_29974` |
| 196 | Proyectos de Investigación | `com_10533_30179` |
| 46 | Capital Humano | `com_10533_89260` |
| 21 | FONDEF | `com_10533_29666` |
| 21 | Redes Estrategia y Conocimiento | — |
| 16 | PFCHA-Becas | — |
| 7 | Programa de Información Científica | `com_10533_29811` |
| … | Otros (EXPLORA, FONDAP, PIA, etc.) | ver `ListSets` |

**216** registros UTA no traen etiqueta `dc.description.conicytprogram` / `shortconicytprogram`.

### Campos de metadatos para afiliación e interoperabilidad

| Campo REST | Uso |
|------------|-----|
| `dc.contributor.institution` | Institución principal (tesis, algunos proyectos) |
| `dc.contributor.corporatename` | Institución en proyectos FONDECYT/FONDEF |
| `datacite.contributor` | Institución en formato DataCite |
| `dc.description.conicytprogram` | Programa ANID (FONDECYT, FONDEF, …) |
| `dc.relation.program` | Handle del programa (`handle/10533/108045`) |
| `dc.relation.instrument` | Handle del instrumento |
| `dc.relation.contest` | Handle del concurso/colección |
| `dspace.entity.type` | `Proyecto`, `Tesis`, `InformeFinal`, `Patente` |

### Relación con este proyecto

- Enlace investigador ↔ perfil ANID: `src/utils/anidLinkage.ts` + `src/data/anid-linkage.json` (portal `investigadores.anid.cl`, no OAI).
- Config institucional UTA: `src/config/institution.config.ts`.
- Esta documentación describe el **repositorio de documentos** (`repositorio.anid.cl`), fuente distinta del directorio de investigadores.

---

## Reproducir el análisis UTA

Script mínimo (requiere `curl` y `python3`):

```bash
Q='dc.contributor.institution%3A*Tarapac*+OR+dc.contributor.corporatename%3A*Tarapac*+OR+datacite.contributor%3A*TARAPAC*'
API="https://repositorio.be-anid.com/server/api/discover/search/objects"

# Descargar todas las páginas (772 ítems, size=100 → 8 páginas)
for page in 0 1 2 3 4 5 6 7; do
  curl -s "$API?query=$Q&size=100&page=$page" -o "/tmp/anid-uta-p${page}.json"
done

# Contar por tipo de entidad
python3 -c "
import json, glob
from collections import Counter
c = Counter()
for f in glob.glob('/tmp/anid-uta-p*.json'):
    d = json.load(open(f))
    for o in d['_embedded']['searchResult']['_embedded']['objects']:
        m = o['_embedded']['indexableObject']['metadata']
        et = m.get('dspace.entity.type', [{}])[0].get('value', '?')
        c[et] += 1
for k, v in c.most_common():
    print(v, k)
"
```

---

## Limitaciones conocidas

1. **`repositorio.anid.cl/oai/*` no funciona** — solo sirve el SPA; usar `repositorio.be-anid.com/server/oai/request`.
2. **Cosecha OAI completa** del repositorio (~187k registros) es lenta; para conteos y filtros preferir la API REST.
3. **`owningCollection` en la API** se expone como subrecurso del ítem (`/api/core/items/{uuid}/owningCollection`); para clasificar por colección sin N+1 requests, usar metadatos `dc.relation.contest` o filtros `f.programa` / `f.entityType`.
4. Los conteos UTA dependen de cómo ANID registró la institución en cada instrumento; variantes como `Universidad de Tarapacá`, `UNIVERSIDAD DE TARAPACA` o rutas con facultad/departamento se capturan con el wildcard `*Tarapac*`.

---

## Referencias

- UI pública: https://repositorio.anid.cl  
- OAI-PMH: https://repositorio.be-anid.com/server/oai/request  
- API REST: https://repositorio.be-anid.com/server/api  
- Portal investigadores ANID (otro sistema): https://investigadores.anid.cl  
- Política / interoperabilidad: https://acceso-abierto.anid.cl  
