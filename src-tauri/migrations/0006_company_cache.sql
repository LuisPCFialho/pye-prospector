-- Migration v6: SQLite cache for company resolution results.
-- Survives app restarts; keyed by building_id; 7-day TTL (stale entries cleaned on load).
CREATE TABLE IF NOT EXISTS company_cache (
  building_id  TEXT PRIMARY KEY,
  payload      TEXT NOT NULL,  -- JSON of ResolveResult (candidates, address, geo)
  cached_at    TEXT NOT NULL   -- ISO-8601 timestamp
);
