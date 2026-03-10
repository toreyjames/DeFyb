-- Track provider-side acceptance/finalization in coding workflow

ALTER TABLE encounter_analyses
  ADD COLUMN IF NOT EXISTS accepted_code TEXT;

ALTER TABLE encounter_analyses
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_encounter_analyses_accepted_at
  ON encounter_analyses (accepted_at DESC);

