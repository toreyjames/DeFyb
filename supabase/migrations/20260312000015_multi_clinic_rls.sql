-- Multi-clinic RLS helper + policy updates for encounter domain.

CREATE OR REPLACE FUNCTION public.has_practice_access(p_practice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM clinic_memberships cm
      WHERE cm.auth_user_id = auth.uid()
        AND cm.practice_id = p_practice_id
        AND cm.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM app_users au
      WHERE au.auth_user_id = auth.uid()
        AND au.practice_id = p_practice_id
    );
$$;

-- Encounters
DROP POLICY IF EXISTS "Practice users read encounters" ON encounters;
CREATE POLICY "Practice users read encounters" ON encounters
  FOR SELECT
  USING (public.has_practice_access(encounters.practice_id));

DROP POLICY IF EXISTS "Practice users create encounters" ON encounters;
CREATE POLICY "Practice users create encounters" ON encounters
  FOR INSERT
  WITH CHECK (public.has_practice_access(encounters.practice_id));

DROP POLICY IF EXISTS "Practice users update encounters" ON encounters;
CREATE POLICY "Practice users update encounters" ON encounters
  FOR UPDATE
  USING (public.has_practice_access(encounters.practice_id))
  WITH CHECK (public.has_practice_access(encounters.practice_id));

-- Encounter notes
DROP POLICY IF EXISTS "Practice users access encounter_notes" ON encounter_notes;
CREATE POLICY "Practice users access encounter_notes" ON encounter_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM encounters e
      WHERE e.id = encounter_notes.encounter_id
        AND public.has_practice_access(e.practice_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM encounters e
      WHERE e.id = encounter_notes.encounter_id
        AND public.has_practice_access(e.practice_id)
    )
  );

-- Extracted signals
DROP POLICY IF EXISTS "Practice users access extracted_signals" ON extracted_signals;
CREATE POLICY "Practice users access extracted_signals" ON extracted_signals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM encounters e
      WHERE e.id = extracted_signals.encounter_id
        AND public.has_practice_access(e.practice_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM encounters e
      WHERE e.id = extracted_signals.encounter_id
        AND public.has_practice_access(e.practice_id)
    )
  );

-- Code recommendations
DROP POLICY IF EXISTS "Practice users access code_recommendations" ON code_recommendations;
CREATE POLICY "Practice users access code_recommendations" ON code_recommendations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM encounters e
      WHERE e.id = code_recommendations.encounter_id
        AND public.has_practice_access(e.practice_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM encounters e
      WHERE e.id = code_recommendations.encounter_id
        AND public.has_practice_access(e.practice_id)
    )
  );

-- Revenue impacts
DROP POLICY IF EXISTS "Practice users access revenue_impacts" ON revenue_impacts;
CREATE POLICY "Practice users access revenue_impacts" ON revenue_impacts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM encounters e
      WHERE e.id = revenue_impacts.encounter_id
        AND public.has_practice_access(e.practice_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM encounters e
      WHERE e.id = revenue_impacts.encounter_id
        AND public.has_practice_access(e.practice_id)
    )
  );

-- Audit events
DROP POLICY IF EXISTS "Practice users read audit_events" ON audit_events;
CREATE POLICY "Practice users read audit_events" ON audit_events
  FOR SELECT
  USING (public.has_practice_access(audit_events.practice_id));

DROP POLICY IF EXISTS "Practice users insert audit_events" ON audit_events;
CREATE POLICY "Practice users insert audit_events" ON audit_events
  FOR INSERT
  WITH CHECK (public.has_practice_access(audit_events.practice_id));
