-- Migration v5: performance indexes on hot query paths.
-- These indexes make filter-by-kWp, sort-by-pipeline, and territory queries fast
-- even with thousands of leads.

CREATE INDEX IF NOT EXISTS idx_leads_building_pipeline ON leads(building_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_solar    ON leads(pipeline_stage, solar_status);
CREATE INDEX IF NOT EXISTS idx_leads_flagged           ON leads(flagged) WHERE flagged = 1;
CREATE INDEX IF NOT EXISTS idx_leads_updated           ON leads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_buildings_centroid      ON buildings(centroid_lat, centroid_lon);
