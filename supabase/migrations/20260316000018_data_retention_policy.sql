-- Data Retention Policy
-- 3-tier model: 90-day PHI purge, 7-year billing intelligence, 10-year audit trail.

-- ------------------------------------------------------------
-- Retention policy definitions (queryable by auditors)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL UNIQUE,
  target_table TEXT NOT NULL,
  scrub_columns TEXT[] NOT NULL DEFAULT '{}',
  retention_interval INTERVAL NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO retention_policies (tier, target_table, scrub_columns, retention_interval, description)
VALUES
  (
    'encounter_notes_phi',
    'encounter_notes',
    ARRAY['raw_note', 'normalized_note'],
    INTERVAL '90 days',
    'Raw clinical note text is scrubbed (NULLed) after 90 days. DeFyb is not a note storage system; the EHR is the system of record.'
  ),
  (
    'billing_intelligence',
    'extracted_signals,code_recommendations,revenue_impacts,claim_outcomes',
    '{}',
    INTERVAL '7 years',
    'Billing intelligence (signals, recommendations, revenue impacts, claim outcomes) retained for audit defense and payer review.'
  ),
  (
    'audit_trail',
    'audit_events',
    '{}',
    INTERVAL '10 years',
    'Audit events retained for compliance chain-of-custody. Covers extended False Claims Act lookback.'
  )
ON CONFLICT (tier) DO NOTHING;

-- ------------------------------------------------------------
-- Scrub execution log (proves enforcement to auditors)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS retention_scrub_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL,
  rows_affected INTEGER NOT NULL DEFAULT 0,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retention_scrub_log_tier
  ON retention_scrub_log (tier, executed_at DESC);

-- ------------------------------------------------------------
-- Allow raw_note to be NULLable (it was NOT NULL in the schema)
-- ------------------------------------------------------------
ALTER TABLE encounter_notes ALTER COLUMN raw_note DROP NOT NULL;

-- ------------------------------------------------------------
-- Scrub function
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scrub_expired_notes(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  scrubbed_count INTEGER;
BEGIN
  UPDATE encounter_notes
  SET raw_note = NULL, normalized_note = NULL
  WHERE created_at < now() - make_interval(days => retention_days)
    AND raw_note IS NOT NULL;

  GET DIAGNOSTICS scrubbed_count = ROW_COUNT;

  INSERT INTO retention_scrub_log (tier, rows_affected)
  VALUES ('encounter_notes_phi', scrubbed_count);

  RETURN scrubbed_count;
END;
$$;

-- RLS: retention tables are team-only.
ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_scrub_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team read retention_policies" ON retention_policies;
CREATE POLICY "Team read retention_policies" ON retention_policies
  FOR SELECT
  USING (public.is_team_role());

DROP POLICY IF EXISTS "Team read retention_scrub_log" ON retention_scrub_log;
CREATE POLICY "Team read retention_scrub_log" ON retention_scrub_log
  FOR SELECT
  USING (public.is_team_role());
