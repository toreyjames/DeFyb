-- Versioned fee schedule support for CMS/PFS ingestion and traceable rate lookup.

CREATE TABLE IF NOT EXISTS fee_schedule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('cms_pfs', 'fallback', 'payer_contract', 'manual')),
  version TEXT NOT NULL,
  effective_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES app_users(id) ON DELETE SET NULL,
  UNIQUE (source, version)
);

CREATE INDEX IF NOT EXISTS idx_fee_schedule_versions_active
  ON fee_schedule_versions(source, status, effective_date DESC, imported_at DESC);

ALTER TABLE payer_rates
  ADD COLUMN IF NOT EXISTS locality TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS fee_schedule_version_id UUID NULL REFERENCES fee_schedule_versions(id) ON DELETE SET NULL;

UPDATE payer_rates SET state = COALESCE(state, '') WHERE state IS NULL;
ALTER TABLE payer_rates ALTER COLUMN state SET DEFAULT '';
ALTER TABLE payer_rates ALTER COLUMN state SET NOT NULL;

UPDATE payer_rates SET locality = COALESCE(locality, '') WHERE locality IS NULL;
ALTER TABLE payer_rates ALTER COLUMN locality SET DEFAULT '';
ALTER TABLE payer_rates ALTER COLUMN locality SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payer_rates_version_id
  ON payer_rates(fee_schedule_version_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payer_rates_unique_versioned
  ON payer_rates(payer_name, state, locality, cpt_code, effective_date, source, version);

-- Seed fallback version and link existing fallback rows.
INSERT INTO fee_schedule_versions (source, version, effective_date, status, metadata_json)
VALUES ('fallback', 'fallback-v1', CURRENT_DATE, 'active', '{"seeded":true}'::jsonb)
ON CONFLICT (source, version) DO NOTHING;

UPDATE payer_rates pr
SET
  source = CASE
    WHEN pr.payer_name = 'FALLBACK' THEN 'fallback'
    WHEN pr.payer_name = 'CMS_PFS' THEN 'cms_pfs'
    ELSE COALESCE(pr.source, 'manual')
  END,
  fee_schedule_version_id = COALESCE(
    pr.fee_schedule_version_id,
    (
      SELECT fsv.id
      FROM fee_schedule_versions fsv
      WHERE fsv.source = CASE
        WHEN pr.payer_name = 'FALLBACK' THEN 'fallback'
        WHEN pr.payer_name = 'CMS_PFS' THEN 'cms_pfs'
        ELSE 'manual'
      END
      AND fsv.version = pr.version
      LIMIT 1
    )
  )
WHERE pr.source IS NULL
   OR pr.fee_schedule_version_id IS NULL
   OR pr.payer_name IN ('FALLBACK', 'CMS_PFS');

ALTER TABLE fee_schedule_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team full access on fee_schedule_versions" ON fee_schedule_versions;
CREATE POLICY "Team full access on fee_schedule_versions" ON fee_schedule_versions
  FOR ALL
  USING (public.is_team_role())
  WITH CHECK (public.is_team_role());

-- Non-PHI reference tables can be read by authenticated users.
DROP POLICY IF EXISTS "Authenticated read payer_rates" ON payer_rates;
CREATE POLICY "Authenticated read payer_rates" ON payer_rates
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated read global_rules" ON global_rules;
CREATE POLICY "Authenticated read global_rules" ON global_rules
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated read rule_versions" ON rule_versions;
CREATE POLICY "Authenticated read rule_versions" ON rule_versions
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated read fee_schedule_versions" ON fee_schedule_versions;
CREATE POLICY "Authenticated read fee_schedule_versions" ON fee_schedule_versions
  FOR SELECT
  USING (auth.role() = 'authenticated');
