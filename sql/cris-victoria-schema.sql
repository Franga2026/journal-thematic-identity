-- =============================================================================
-- CRIS VICTORIA — Esquema PostgreSQL
-- =============================================================================
-- Migración desde los JSON estáticos a una base consultable.
--
-- Decisiones de diseño:
--   1. institution_id en todas las tablas → multi-tenant desde el día 1,
--      sin la complejidad de schema-per-tenant.
--   2. authorships como TABLA PROPIA (hoy anidada, pesa el 57% de cada obra).
--      Esto desbloquea el Observatorio de colaboración: pasa de ser un cálculo
--      imposible en el navegador a un simple JOIN.
--   3. Los identificadores externos (OpenAlex, ORCID, ROR, DOI) se guardan tal
--      cual, sin reinterpretar. La honestidad del dato empieza en el esquema:
--      NULL significa "no sabemos", nunca 0.
-- =============================================================================

-- Extensiones útiles
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- búsqueda por similitud de texto
CREATE EXTENSION IF NOT EXISTS unaccent;     -- búsqueda sin tildes (nombres en español)


-- =============================================================================
-- INSTITUCIONES (el tenant)
-- =============================================================================
CREATE TABLE institutions (
  id            SERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,          -- 'uta', 'pucv', ...
  name          TEXT NOT NULL,                 -- 'Universidad de Tarapacá'
  short_name    TEXT,                          -- 'UTA'
  country_code  CHAR(2),                       -- 'CL'
  ror           TEXT,                          -- '04xe01d27'
  openalex_id   TEXT,                          -- 'I185652977'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_institutions_ror ON institutions(ror);
CREATE INDEX idx_institutions_openalex ON institutions(openalex_id);


-- =============================================================================
-- UNIDADES (departamentos, escuelas, institutos)
-- =============================================================================
CREATE TABLE units (
  id              SERIAL PRIMARY KEY,
  institution_id  INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,               -- 'Departamento de Matemática'
  short_name      TEXT,                        -- 'Matemática' (sin el prefijo)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (institution_id, name)
);

CREATE INDEX idx_units_institution ON units(institution_id);


-- =============================================================================
-- INVESTIGADORES
-- =============================================================================
CREATE TABLE researchers (
  id                SERIAL PRIMARY KEY,
  institution_id    INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,

  -- Identificador interno de la institución (en la UTA: el RUT)
  -- Es la clave natural: 367/367 lo tienen.
  local_id          TEXT NOT NULL,

  -- Identidad
  first_name        TEXT,                      -- data.json: f
  last_name         TEXT,                      -- data.json: l
  full_name         TEXT GENERATED ALWAYS AS (
                      TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,''))
                    ) STORED,
  email             TEXT,                      -- data.json: e
  phone             TEXT,                      -- data.json: ph
  position          TEXT,                      -- data.json: t (cargo académico)
  gender            TEXT,                      -- data.json: g

  -- El puente al mundo: ORCID (199/367 lo tienen)
  -- NULL = no registrado. NO inventar.
  orcid             TEXT,

  -- Identificadores de OpenAlex (un investigador puede tener varios)
  openalex_ids      TEXT[],

  -- Métricas de OpenAlex (NULL = no hay datos, NO es cero)
  -- Honestidad del dato: h_index NULL ≠ h_index 0
  h_index           INTEGER,
  works_count       INTEGER,
  cited_by_count    INTEGER,
  mean_citedness    NUMERIC(10,4),             -- summary_stats.2yr_mean_citedness
  metrics_synced_at TIMESTAMPTZ,               -- cuándo se trajeron de OpenAlex

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (institution_id, local_id)
);

CREATE INDEX idx_researchers_institution ON researchers(institution_id);
CREATE INDEX idx_researchers_orcid ON researchers(orcid) WHERE orcid IS NOT NULL;
CREATE INDEX idx_researchers_openalex ON researchers USING GIN(openalex_ids);
CREATE INDEX idx_researchers_name_trgm ON researchers USING GIN(full_name gin_trgm_ops);


-- =============================================================================
-- INVESTIGADOR ↔ UNIDAD  (con el cargo en esa unidad)
-- data.json: dp[] = [{ d: unidad, j: cargo }]
-- Hoy cada investigador está en 1 unidad, pero el modelo soporta varias.
-- =============================================================================
CREATE TABLE researcher_units (
  researcher_id  INTEGER NOT NULL REFERENCES researchers(id) ON DELETE CASCADE,
  unit_id        INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  role           TEXT,                         -- dp[].j (cargo en esa unidad)
  is_primary     BOOLEAN NOT NULL DEFAULT true,

  PRIMARY KEY (researcher_id, unit_id)
);

CREATE INDEX idx_researcher_units_unit ON researcher_units(unit_id);


-- =============================================================================
-- FUENTES (revistas)
-- =============================================================================
CREATE TABLE sources (
  id                SERIAL PRIMARY KEY,
  openalex_id       TEXT UNIQUE,
  name              TEXT NOT NULL,
  publisher         TEXT,

  -- Los ISSN: una revista tiene varios (impreso, electrónico).
  -- Se guardan todos; Scopus puede indexar cualquiera de ellos.
  issns             TEXT[],
  issn_l            TEXT,                      -- el "linking ISSN" de OpenAlex

  -- Cuartil SJR (Scimago). NULL = no está en Scimago, NO es Q4.
  sjr_quartile      TEXT CHECK (sjr_quartile IN ('Q1','Q2','Q3','Q4')),
  sjr_year          INTEGER,

  -- ¿Indexada en Scopus? (del KBART)
  in_scopus         BOOLEAN NOT NULL DEFAULT false,
  scopus_url        TEXT,                      -- la URL OpenURL resuelta

  is_oa             BOOLEAN,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sources_issns ON sources USING GIN(issns);
CREATE INDEX idx_sources_issn_l ON sources(issn_l);
CREATE INDEX idx_sources_name_trgm ON sources USING GIN(name gin_trgm_ops);


-- =============================================================================
-- TEMAS (la jerarquía de OpenAlex: Topic → Subfield → Field → Domain)
-- =============================================================================
CREATE TABLE topics (
  id            SERIAL PRIMARY KEY,
  openalex_id   TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  subfield      TEXT,
  field         TEXT,
  domain        TEXT
);

CREATE INDEX idx_topics_field ON topics(field);


-- =============================================================================
-- OBRAS
-- =============================================================================
CREATE TABLE works (
  id                SERIAL PRIMARY KEY,
  institution_id    INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,

  openalex_id       TEXT,
  doi               TEXT,
  title             TEXT NOT NULL,
  publication_year  INTEGER,
  publication_date  DATE,
  type              TEXT,                      -- article, book-chapter, dataset...

  source_id         INTEGER REFERENCES sources(id),

  -- Métricas (NULL = sin datos, NO cero)
  cited_by_count    INTEGER,
  fwci              NUMERIC(10,4),             -- Field-Weighted Citation Impact
  percentile        NUMERIC(5,2),              -- percentil de citación

  -- Acceso abierto
  is_oa             BOOLEAN,
  oa_status         TEXT,                      -- gold, green, hybrid, bronze, closed
  oa_url            TEXT,

  -- Tema principal
  primary_topic_id  INTEGER REFERENCES topics(id),

  -- El resumen (reconstruido del abstract_inverted_index de OpenAlex)
  abstract          TEXT,

  -- Datos crudos que aún no modelamos (Crossref, Unpaywall, etc.)
  -- Válvula de escape: no perdemos información durante la migración.
  raw               JSONB,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (institution_id, openalex_id)
);

CREATE INDEX idx_works_institution ON works(institution_id);
CREATE INDEX idx_works_year ON works(institution_id, publication_year);
CREATE INDEX idx_works_source ON works(source_id);
CREATE INDEX idx_works_topic ON works(primary_topic_id);
CREATE INDEX idx_works_doi ON works(doi) WHERE doi IS NOT NULL;
CREATE INDEX idx_works_fwci ON works(institution_id, fwci DESC NULLS LAST);
CREATE INDEX idx_works_title_trgm ON works USING GIN(title gin_trgm_ops);


-- =============================================================================
-- AUTORÍAS — LA TABLA CLAVE
-- =============================================================================
-- Hoy 'authorships' vive anidado dentro de cada obra: 1.366 de 2.403 bytes
-- (el 57% del peso). Normalizarla es lo que desbloquea el Observatorio de
-- colaboración: las redes de coautoría pasan de ser un cálculo imposible en el
-- navegador a un JOIN.
--
-- Incluye TANTO a los autores UTA como a los EXTERNOS. Los externos no tienen
-- researcher_id (no están en el catálogo), pero sí su nombre y su OpenAlex ID.
-- =============================================================================
CREATE TABLE authorships (
  id                  SERIAL PRIMARY KEY,
  work_id             INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,

  -- Si es un investigador de la institución, apunta al catálogo.
  -- Si es externo, queda NULL (pero conservamos su nombre y OpenAlex ID).
  researcher_id       INTEGER REFERENCES researchers(id) ON DELETE SET NULL,

  -- Datos del autor tal como vienen de OpenAlex
  author_openalex_id  TEXT,
  author_name         TEXT NOT NULL,
  author_orcid        TEXT,

  author_position     INTEGER,                 -- 0 = primer autor
  is_corresponding    BOOLEAN,

  -- Afiliación declarada en ESTA obra (puede diferir de la actual)
  institution_name    TEXT,
  institution_ror     TEXT,
  institution_country CHAR(2),

  -- ¿Es de nuestra institución? (denormalizado para consultas rápidas)
  is_internal         BOOLEAN NOT NULL DEFAULT false,

  UNIQUE (work_id, author_position)
);

CREATE INDEX idx_authorships_work ON authorships(work_id);
CREATE INDEX idx_authorships_researcher ON authorships(researcher_id)
  WHERE researcher_id IS NOT NULL;
CREATE INDEX idx_authorships_author_oa ON authorships(author_openalex_id)
  WHERE author_openalex_id IS NOT NULL;
CREATE INDEX idx_authorships_country ON authorships(institution_country)
  WHERE institution_country IS NOT NULL;
CREATE INDEX idx_authorships_internal ON authorships(work_id, is_internal);


-- =============================================================================
-- OBRA ↔ TEMAS (una obra puede tener varios)
-- =============================================================================
CREATE TABLE work_topics (
  work_id   INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  topic_id  INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  score     NUMERIC(5,4),

  PRIMARY KEY (work_id, topic_id)
);

CREATE INDEX idx_work_topics_topic ON work_topics(topic_id);


-- =============================================================================
-- OBRA ↔ ODS (Objetivos de Desarrollo Sostenible)
-- =============================================================================
CREATE TABLE work_sdgs (
  work_id   INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  sdg_id    INTEGER NOT NULL,                  -- 1..17
  sdg_name  TEXT,
  score     NUMERIC(5,4),

  PRIMARY KEY (work_id, sdg_id)
);

CREATE INDEX idx_work_sdgs_sdg ON work_sdgs(sdg_id);


-- =============================================================================
-- VISTAS ÚTILES — lo que hoy se calcula en el navegador
-- =============================================================================

-- Cobertura ORCID por unidad (hoy: getDeptOrcidCoverage() en el cliente)
CREATE VIEW v_unit_orcid_coverage AS
SELECT
  u.id                                          AS unit_id,
  u.institution_id,
  u.name                                        AS unit_name,
  COUNT(r.id)                                   AS total,
  COUNT(r.orcid)                                AS with_orcid,
  ROUND(100.0 * COUNT(r.orcid) / NULLIF(COUNT(r.id), 0)) AS pct
FROM units u
LEFT JOIN researcher_units ru ON ru.unit_id = u.id
LEFT JOIN researchers r ON r.id = ru.researcher_id
GROUP BY u.id, u.institution_id, u.name;


-- Colaboración por obra (la base del Observatorio).
-- LEFT JOIN: obras sin authorships → 'sin_datos' (honestidad; no inventar
-- institucional). Antes has_internal/has_external pueden derivarse de authorships.
CREATE VIEW v_work_collaboration AS
SELECT
  w.id                                    AS work_id,
  w.institution_id,
  w.publication_year,
  COUNT(DISTINCT a.institution_country)   AS countries,
  COUNT(DISTINCT a.institution_ror)       AS institutions,
  CASE
    -- Sin datos de afiliación → no se puede clasificar. Honestidad.
    WHEN COUNT(a.id) = 0                           THEN 'sin_datos'
    WHEN COUNT(DISTINCT a.institution_country) > 1 THEN 'internacional'
    WHEN COUNT(DISTINCT a.institution_ror) > 1     THEN 'nacional'
    ELSE 'institucional'
  END                                     AS collaboration_scope
FROM works w
LEFT JOIN authorships a ON a.work_id = w.id
GROUP BY w.id, w.institution_id, w.publication_year;
