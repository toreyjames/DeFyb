-- Add structured encounter context + model version tracking

ALTER TABLE encounter_analyses
  ADD COLUMN IF NOT EXISTS encounter_context JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE encounter_analyses
  ADD COLUMN IF NOT EXISTS model_version TEXT NOT NULL DEFAULT 'rules-v1.0';

CREATE INDEX IF NOT EXISTS idx_encounter_analyses_model_version_created
  ON encounter_analyses (model_version, created_at DESC);

