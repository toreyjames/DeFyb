-- HIPAA hardening for encounter analysis storage
-- Goal: keep billing intelligence, avoid storing raw clinical note content.

ALTER TABLE encounter_analyses
  ALTER COLUMN note_text DROP NOT NULL;

-- Backfill existing records to remove persisted note content/snippets.
UPDATE encounter_analyses
SET
  note_text = NULL,
  note_snippet = NULL
WHERE note_text IS NOT NULL OR note_snippet IS NOT NULL;

-- Ensure policies are always enforced, even for table owner context.
ALTER TABLE encounter_analyses FORCE ROW LEVEL SECURITY;

