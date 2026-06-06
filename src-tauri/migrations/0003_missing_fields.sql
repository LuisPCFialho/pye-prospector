-- Migration v3: Add missing fields that were in the Lead type but not in the database.
-- Omitting these caused data loss on restart (flagged status, drop reasons, email).
-- SQLite ALTER TABLE does not support IF NOT EXISTS — the Tauri migration runner
-- guarantees each version runs exactly once, so these are safe.

ALTER TABLE leads ADD COLUMN flagged     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN drop_reason TEXT;
ALTER TABLE leads ADD COLUMN email       TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_flagged ON leads(flagged);
