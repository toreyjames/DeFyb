-- Production encounter analysis storage for coding tool

CREATE TABLE IF NOT EXISTS encounter_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  specialty TEXT DEFAULT 'General',
  note_text TEXT NOT NULL,
  note_snippet TEXT,
  billed_code TEXT NOT NULL,
  suggested_code TEXT NOT NULL,
  confidence NUMERIC NOT NULL,
  rationale JSONB NOT NULL DEFAULT '[]',
  gaps JSONB NOT NULL DEFAULT '[]',
  suggestions JSONB NOT NULL DEFAULT '[]',
  estimated_delta_per_visit NUMERIC NOT NULL DEFAULT 0,
  estimated_monthly_recovery NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encounter_analyses_user_created
  ON encounter_analyses (user_id, created_at DESC);

ALTER TABLE encounter_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own encounter analyses" ON encounter_analyses;
CREATE POLICY "Users can read own encounter analyses"
  ON encounter_analyses
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own encounter analyses" ON encounter_analyses;
CREATE POLICY "Users can insert own encounter analyses"
  ON encounter_analyses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own encounter analyses" ON encounter_analyses;
CREATE POLICY "Users can update own encounter analyses"
  ON encounter_analyses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

