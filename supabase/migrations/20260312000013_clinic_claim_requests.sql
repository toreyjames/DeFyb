-- Provider-first provisional workspace claim workflow.
-- Allows a provider to start usage, then request owner/admin clinic claim approval.

CREATE TABLE IF NOT EXISTS clinic_claim_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID NOT NULL DEFAULT auth.uid(),
  requester_email TEXT,
  requester_name TEXT,
  clinic_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  source TEXT NOT NULL DEFAULT 'practice_tool',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);

CREATE INDEX IF NOT EXISTS idx_clinic_claim_requests_requester
  ON clinic_claim_requests (requester_user_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinic_claim_requests_status
  ON clinic_claim_requests (status, submitted_at DESC);

ALTER TABLE clinic_claim_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Requester can insert claim request" ON clinic_claim_requests;
CREATE POLICY "Requester can insert claim request"
  ON clinic_claim_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_user_id);

DROP POLICY IF EXISTS "Requester can read own claim request" ON clinic_claim_requests;
CREATE POLICY "Requester can read own claim request"
  ON clinic_claim_requests
  FOR SELECT
  TO authenticated
  USING (
    requester_user_id = auth.uid()
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('team', 'admin', 'owner')
  );

DROP POLICY IF EXISTS "Team can review claim request" ON clinic_claim_requests;
CREATE POLICY "Team can review claim request"
  ON clinic_claim_requests
  FOR UPDATE
  TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('team', 'admin', 'owner'))
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('team', 'admin', 'owner'));
