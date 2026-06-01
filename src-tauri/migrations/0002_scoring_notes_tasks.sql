-- Migration v2: Lead scoring, notes, tasks, and richer company fields

-- Add scoring and richer fields to leads
ALTER TABLE leads ADD COLUMN score INTEGER;
ALTER TABLE leads ADD COLUMN score_explanations TEXT;     -- JSON array of strings
ALTER TABLE leads ADD COLUMN nif TEXT;                    -- Portuguese VAT number
ALTER TABLE leads ADD COLUMN cae TEXT;                    -- Portuguese activity classification
ALTER TABLE leads ADD COLUMN estimated_value_eur REAL;    -- Estimated deal value
ALTER TABLE leads ADD COLUMN probability INTEGER;         -- 0-100
ALTER TABLE leads ADD COLUMN industrial_park TEXT;        -- Source park slug if from preset
ALTER TABLE leads ADD COLUMN building_use TEXT;           -- food_beverage, metalwork, logistics, retail, hotels, agriculture, other
ALTER TABLE leads ADD COLUMN has_existing_pv TEXT;        -- 'yes', 'no', 'unknown'

CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
CREATE INDEX IF NOT EXISTS idx_leads_industrial_park ON leads(industrial_park);

-- Notes per lead
CREATE TABLE IF NOT EXISTS lead_notes (
    id          TEXT PRIMARY KEY,
    lead_id     TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    author      TEXT NOT NULL DEFAULT 'Eu',
    body        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_created_at ON lead_notes(created_at DESC);

-- Tasks per lead
CREATE TABLE IF NOT EXISTS lead_tasks (
    id          TEXT PRIMARY KEY,
    lead_id     TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    done        INTEGER NOT NULL DEFAULT 0,    -- SQLite boolean (0/1)
    due_date    TEXT,                          -- ISO date
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_lead_id ON lead_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_done ON lead_tasks(done);
