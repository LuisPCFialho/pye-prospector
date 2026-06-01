-- PYE Prospector initial schema (SQLite)
-- Geometries are stored as GeoJSON TEXT; spatial operations happen client-side via Turf.js.
-- For bbox queries we keep centroid_lon/lat as indexed columns.

CREATE TABLE IF NOT EXISTS buildings (
    id            TEXT PRIMARY KEY,
    osm_id        INTEGER,
    source        TEXT NOT NULL CHECK (source IN ('osm', 'ms_footprints', 'manual')),
    geometry      TEXT NOT NULL,            -- GeoJSON Polygon/MultiPolygon
    centroid_lon  REAL NOT NULL,
    centroid_lat  REAL NOT NULL,
    area_sqm      REAL NOT NULL,
    building_tag  TEXT,
    name          TEXT,
    operator      TEXT,
    raw_tags      TEXT,                     -- JSON
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_buildings_centroid_lon ON buildings(centroid_lon);
CREATE INDEX IF NOT EXISTS idx_buildings_centroid_lat ON buildings(centroid_lat);
CREATE INDEX IF NOT EXISTS idx_buildings_osm_id ON buildings(osm_id);

CREATE TABLE IF NOT EXISTS leads (
    id                       TEXT PRIMARY KEY,
    building_id              TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    address                  TEXT,
    solar_status             TEXT NOT NULL DEFAULT 'unknown'
        CHECK (solar_status IN ('unknown','no_panels','has_panels','partial','inconclusive')),
    pipeline_stage           TEXT NOT NULL DEFAULT 'to_contact'
        CHECK (pipeline_stage IN ('to_contact','contacted','meeting','proposal','won','lost')),
    estimated_kwh_per_year   REAL,
    estimated_kwp            REAL,
    monthly_kwh              TEXT,            -- JSON array of 12 values
    company                  TEXT,
    telephone                TEXT,
    website                  TEXT,
    tags                     TEXT,
    owner                    TEXT,
    notes                    TEXT,
    created_at               TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_building_id ON leads(building_id);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON leads(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_solar_status ON leads(solar_status);

CREATE TABLE IF NOT EXISTS territories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    polygon     TEXT NOT NULL,              -- GeoJSON Polygon
    bbox        TEXT NOT NULL,              -- "minLon,minLat,maxLon,maxLat"
    notes       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
