-- Core schema for coding guardrail platform (phase 1)
-- This migration adds new practice-scoped tables with strict RLS.

-- ------------------------------------------------------------
-- Utility helpers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_team_role()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('team', 'admin', 'owner');
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- Providers and app users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  specialty TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_providers_practice_id ON providers(practice_id);

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_id UUID NULL REFERENCES providers(id) ON DELETE SET NULL,
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'provider', 'reviewer', 'office_manager')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_users_practice_id ON app_users(practice_id);
CREATE INDEX IF NOT EXISTS idx_app_users_auth_user_id ON app_users(auth_user_id);

-- ------------------------------------------------------------
-- Encounter domain tables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  provider_id UUID NULL REFERENCES providers(id) ON DELETE SET NULL,
  patient_ref TEXT,
  encounter_date DATE NOT NULL,
  visit_type TEXT,
  patient_type TEXT,
  pos TEXT,
  telehealth BOOLEAN NOT NULL DEFAULT false,
  minutes INTEGER NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encounters_practice_id ON encounters(practice_id);
CREATE INDEX IF NOT EXISTS idx_encounters_provider_id ON encounters(provider_id);
CREATE INDEX IF NOT EXISTS idx_encounters_encounter_date ON encounters(encounter_date DESC);

DROP TRIGGER IF EXISTS encounters_touch_updated_at ON encounters;
CREATE TRIGGER encounters_touch_updated_at
  BEFORE UPDATE ON encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS encounter_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  raw_note TEXT NOT NULL,
  normalized_note TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encounter_notes_encounter_id ON encounter_notes(encounter_id);
CREATE INDEX IF NOT EXISTS idx_encounter_notes_created_at ON encounter_notes(created_at DESC);

CREATE TABLE IF NOT EXISTS extracted_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  rule_version TEXT NOT NULL,
  signals_json JSONB NOT NULL,
  confidence NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extracted_signals_encounter_id ON extracted_signals(encounter_id);
CREATE INDEX IF NOT EXISTS idx_extracted_signals_rule_version ON extracted_signals(rule_version, created_at DESC);

CREATE TABLE IF NOT EXISTS code_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  rule_version TEXT NOT NULL,
  suggested_code TEXT NOT NULL,
  confidence TEXT,
  rationale_json JSONB NOT NULL,
  documentation_gap_text TEXT,
  current_user_selected_code TEXT,
  status TEXT NOT NULL DEFAULT 'suggested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_code_recommendations_encounter_id ON code_recommendations(encounter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_code_recommendations_status ON code_recommendations(status, created_at DESC);

CREATE TABLE IF NOT EXISTS revenue_impacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  payer_name TEXT,
  current_code TEXT,
  suggested_code TEXT NOT NULL,
  current_amount NUMERIC(10,2),
  suggested_amount NUMERIC(10,2),
  delta_amount NUMERIC(10,2),
  rate_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revenue_impacts_encounter_id ON revenue_impacts(encounter_id);

CREATE TABLE IF NOT EXISTS payer_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_name TEXT NOT NULL,
  state TEXT,
  cpt_code TEXT NOT NULL,
  allowed_amount NUMERIC(10,2) NOT NULL,
  effective_date DATE NOT NULL,
  version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payer_rates_lookup
  ON payer_rates(payer_name, state, cpt_code, effective_date DESC);

CREATE TABLE IF NOT EXISTS global_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_code TEXT NOT NULL,
  global_days INTEGER NOT NULL,
  effective_date DATE NOT NULL,
  version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_global_rules_lookup
  ON global_rules(procedure_code, effective_date DESC);

CREATE TABLE IF NOT EXISTS claim_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  submitted_code TEXT,
  final_paid_code TEXT,
  paid_amount NUMERIC(10,2),
  denial_reason TEXT,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_outcomes_encounter_id ON claim_outcomes(encounter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  encounter_id UUID NULL REFERENCES encounters(id) ON DELETE CASCADE,
  actor_user_id UUID NULL REFERENCES app_users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_practice_id ON audit_events(practice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_encounter_id ON audit_events(encounter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rule_versions_active ON rule_versions(is_active, created_at DESC);

INSERT INTO rule_versions (version, description, is_active)
VALUES ('rules-v1.0-em-core', 'Initial deterministic E/M guardrail ruleset', true)
ON CONFLICT (version) DO NOTHING;

INSERT INTO global_rules (procedure_code, global_days, effective_date, version)
VALUES ('POSTOP_DEFAULT', 90, CURRENT_DATE, 'global-v1')
ON CONFLICT DO NOTHING;

-- Optional seed payer fallback rates (non-authoritative placeholders)
INSERT INTO payer_rates (payer_name, state, cpt_code, allowed_amount, effective_date, version)
VALUES
  ('FALLBACK', NULL, '99213', 95.00, CURRENT_DATE, 'fallback-v1'),
  ('FALLBACK', NULL, '99214', 142.00, CURRENT_DATE, 'fallback-v1'),
  ('FALLBACK', NULL, '99215', 206.00, CURRENT_DATE, 'fallback-v1'),
  ('FALLBACK', NULL, '99024', 0.00, CURRENT_DATE, 'fallback-v1')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounter_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_impacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payer_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_versions ENABLE ROW LEVEL SECURITY;

-- Team role can manage everything in this domain.
DROP POLICY IF EXISTS "Team full access on providers" ON providers;
CREATE POLICY "Team full access on providers" ON providers
  FOR ALL
  USING (public.is_team_role())
  WITH CHECK (public.is_team_role());

DROP POLICY IF EXISTS "Team full access on app_users" ON app_users;
CREATE POLICY "Team full access on app_users" ON app_users
  FOR ALL
  USING (public.is_team_role())
  WITH CHECK (public.is_team_role());

DROP POLICY IF EXISTS "Team full access on encounters" ON encounters;
CREATE POLICY "Team full access on encounters" ON encounters
  FOR ALL
  USING (public.is_team_role())
  WITH CHECK (public.is_team_role());

DROP POLICY IF EXISTS "Team full access on encounter_notes" ON encounter_notes;
CREATE POLICY "Team full access on encounter_notes" ON encounter_notes
  FOR ALL
  USING (public.is_team_role())
  WITH CHECK (public.is_team_role());

DROP POLICY IF EXISTS "Team full access on extracted_signals" ON extracted_signals;
CREATE POLICY "Team full access on extracted_signals" ON extracted_signals
  FOR ALL
  USING (public.is_team_role())
  WITH CHECK (public.is_team_role());

DROP POLICY IF EXISTS "Team full access on code_recommendations" ON code_recommendations;
CREATE POLICY "Team full access on code_recommendations" ON code_recommendations
  FOR ALL
  USING (public.is_team_role())
  WITH CHECK (public.is_team_role());

DROP POLICY IF EXISTS "Team full access on revenue_impacts" ON revenue_impacts;
CREATE POLICY "Team full access on revenue_impacts" ON revenue_impacts
  FOR ALL
  USING (public.is_team_role())
  WITH CHECK (public.is_team_role());

DROP POLICY IF EXISTS "Team full access on payer_rates" ON payer_rates;
CREATE POLICY "Team full access on payer_rates" ON payer_rates
  FOR ALL
  USING (public.is_team_role())
  WITH CHECK (public.is_team_role());

DROP POLICY IF EXISTS "Team full access on global_rules" ON global_rules;
CREATE POLICY "Team full access on global_rules" ON global_rules
  FOR ALL
  USING (public.is_team_role())
  WITH CHECK (public.is_team_role());

DROP POLICY IF EXISTS "Team full access on claim_outcomes" ON claim_outcomes;
CREATE POLICY "Team full access on claim_outcomes" ON claim_outcomes
  FOR ALL
  USING (public.is_team_role())
  WITH CHECK (public.is_team_role());

DROP POLICY IF EXISTS "Team full access on audit_events" ON audit_events;
CREATE POLICY "Team full access on audit_events" ON audit_events
  FOR ALL
  USING (public.is_team_role())
  WITH CHECK (public.is_team_role());

DROP POLICY IF EXISTS "Team full access on rule_versions" ON rule_versions;
CREATE POLICY "Team full access on rule_versions" ON rule_versions
  FOR ALL
  USING (public.is_team_role())
  WITH CHECK (public.is_team_role());

-- Practice-scoped access for app users.
DROP POLICY IF EXISTS "Practice users read providers" ON providers;
CREATE POLICY "Practice users read providers" ON providers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM app_users au
      WHERE au.auth_user_id = auth.uid()
        AND au.practice_id = providers.practice_id
    )
  );

DROP POLICY IF EXISTS "Practice admins manage providers" ON providers;
CREATE POLICY "Practice admins manage providers" ON providers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM app_users au
      WHERE au.auth_user_id = auth.uid()
        AND au.practice_id = providers.practice_id
        AND au.role IN ('admin', 'office_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app_users au
      WHERE au.auth_user_id = auth.uid()
        AND au.practice_id = providers.practice_id
        AND au.role IN ('admin', 'office_manager')
    )
  );

DROP POLICY IF EXISTS "Users read own app_user row" ON app_users;
CREATE POLICY "Users read own app_user row" ON app_users
  FOR SELECT
  USING (
    auth.uid() = auth_user_id
    OR EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.auth_user_id = auth.uid()
        AND au.practice_id = app_users.practice_id
        AND au.role IN ('admin', 'office_manager')
    )
  );

DROP POLICY IF EXISTS "Users update own app_user row" ON app_users;
CREATE POLICY "Users update own app_user row" ON app_users
  FOR UPDATE
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Practice users read encounters" ON encounters;
CREATE POLICY "Practice users read encounters" ON encounters
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.auth_user_id = auth.uid()
        AND au.practice_id = encounters.practice_id
    )
  );

DROP POLICY IF EXISTS "Practice users create encounters" ON encounters;
CREATE POLICY "Practice users create encounters" ON encounters
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.auth_user_id = auth.uid()
        AND au.practice_id = encounters.practice_id
    )
  );

DROP POLICY IF EXISTS "Practice users update encounters" ON encounters;
CREATE POLICY "Practice users update encounters" ON encounters
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.auth_user_id = auth.uid()
        AND au.practice_id = encounters.practice_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.auth_user_id = auth.uid()
        AND au.practice_id = encounters.practice_id
    )
  );

DROP POLICY IF EXISTS "Practice users access encounter_notes" ON encounter_notes;
CREATE POLICY "Practice users access encounter_notes" ON encounter_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM encounters e
      JOIN app_users au ON au.practice_id = e.practice_id
      WHERE e.id = encounter_notes.encounter_id
        AND au.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM encounters e
      JOIN app_users au ON au.practice_id = e.practice_id
      WHERE e.id = encounter_notes.encounter_id
        AND au.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Practice users access extracted_signals" ON extracted_signals;
CREATE POLICY "Practice users access extracted_signals" ON extracted_signals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM encounters e
      JOIN app_users au ON au.practice_id = e.practice_id
      WHERE e.id = extracted_signals.encounter_id
        AND au.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM encounters e
      JOIN app_users au ON au.practice_id = e.practice_id
      WHERE e.id = extracted_signals.encounter_id
        AND au.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Practice users access code_recommendations" ON code_recommendations;
CREATE POLICY "Practice users access code_recommendations" ON code_recommendations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM encounters e
      JOIN app_users au ON au.practice_id = e.practice_id
      WHERE e.id = code_recommendations.encounter_id
        AND au.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM encounters e
      JOIN app_users au ON au.practice_id = e.practice_id
      WHERE e.id = code_recommendations.encounter_id
        AND au.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Practice users access revenue_impacts" ON revenue_impacts;
CREATE POLICY "Practice users access revenue_impacts" ON revenue_impacts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM encounters e
      JOIN app_users au ON au.practice_id = e.practice_id
      WHERE e.id = revenue_impacts.encounter_id
        AND au.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM encounters e
      JOIN app_users au ON au.practice_id = e.practice_id
      WHERE e.id = revenue_impacts.encounter_id
        AND au.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Practice users access claim_outcomes" ON claim_outcomes;
CREATE POLICY "Practice users access claim_outcomes" ON claim_outcomes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM encounters e
      JOIN app_users au ON au.practice_id = e.practice_id
      WHERE e.id = claim_outcomes.encounter_id
        AND au.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM encounters e
      JOIN app_users au ON au.practice_id = e.practice_id
      WHERE e.id = claim_outcomes.encounter_id
        AND au.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Practice users read audit_events" ON audit_events;
CREATE POLICY "Practice users read audit_events" ON audit_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM app_users au
      WHERE au.auth_user_id = auth.uid()
        AND au.practice_id = audit_events.practice_id
    )
  );

DROP POLICY IF EXISTS "Practice users insert audit_events" ON audit_events;
CREATE POLICY "Practice users insert audit_events" ON audit_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app_users au
      WHERE au.auth_user_id = auth.uid()
        AND au.practice_id = audit_events.practice_id
    )
  );

