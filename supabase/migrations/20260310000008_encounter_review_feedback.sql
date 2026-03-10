-- Add review feedback fields for coding validation loop

ALTER TABLE encounter_analyses
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'agree', 'disagree'));

ALTER TABLE encounter_analyses
  ADD COLUMN IF NOT EXISTS reviewer_code TEXT;

ALTER TABLE encounter_analyses
  ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;

ALTER TABLE encounter_analyses
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_encounter_analyses_review_status
  ON encounter_analyses (review_status, created_at DESC);

