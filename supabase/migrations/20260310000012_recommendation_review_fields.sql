-- Reviewer workflow fields on recommendation history

ALTER TABLE code_recommendations
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'agree', 'disagree'));

ALTER TABLE code_recommendations
  ADD COLUMN IF NOT EXISTS reviewer_code TEXT;

ALTER TABLE code_recommendations
  ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;

ALTER TABLE code_recommendations
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_code_recommendations_review_status
  ON code_recommendations (review_status, created_at DESC);

