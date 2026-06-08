-- Migration v4: CRM features — territory links, activity log, contacts, follow-ups.
-- The territories table already exists (0001). score/score_explanations exist (0002).

ALTER TABLE leads ADD COLUMN territory_id     TEXT;
ALTER TABLE leads ADD COLUMN next_action_date TEXT;   -- ISO date for follow-up
ALTER TABLE leads ADD COLUMN next_action_note TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_territory_id ON leads(territory_id);
CREATE INDEX IF NOT EXISTS idx_leads_next_action ON leads(next_action_date);

-- Activity timeline per lead (calls, emails, meetings, stage changes…)
CREATE TABLE IF NOT EXISTS lead_activities (
  id          TEXT PRIMARY KEY,
  lead_id     TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,    -- call|email|meeting|note|stage_change|created
  body        TEXT,
  meta        TEXT,             -- JSON, e.g. { from, to } for stage_change
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id, created_at DESC);

-- Multiple contacts per lead/company
CREATE TABLE IF NOT EXISTS lead_contacts (
  id          TEXT PRIMARY KEY,
  lead_id     TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT,
  phone       TEXT,
  email       TEXT,
  is_primary  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lead_contacts_lead ON lead_contacts(lead_id);
