-- Migration v7: SQLite cache for automatic roof obstacle detection results.
-- Survives app restarts; keyed by building_id; 30-day TTL (stale entries cleaned on load).
CREATE TABLE IF NOT EXISTS roof_obstacles (
  building_id  TEXT PRIMARY KEY,
  payload      TEXT NOT NULL,  -- JSON of DetectedObstacle[]
  detected_at  TEXT NOT NULL   -- ISO-8601 timestamp
);
