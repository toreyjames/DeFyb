-- Multi-clinic membership foundation: one auth user can belong to multiple practices.

CREATE TABLE IF NOT EXISTS clinic_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  clinic_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'provider', 'reviewer', 'office_manager')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (auth_user_id, practice_id)
);

CREATE INDEX IF NOT EXISTS idx_clinic_memberships_auth_user
  ON clinic_memberships (auth_user_id, status, is_default DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinic_memberships_practice
  ON clinic_memberships (practice_id, status, created_at DESC);

DROP TRIGGER IF EXISTS clinic_memberships_touch_updated_at ON clinic_memberships;
CREATE TRIGGER clinic_memberships_touch_updated_at
  BEFORE UPDATE ON clinic_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Backfill existing single-practice users into memberships.
INSERT INTO clinic_memberships (auth_user_id, practice_id, clinic_name, role, status, is_default)
SELECT
  au.auth_user_id,
  au.practice_id,
  p.name,
  CASE
    WHEN au.role = 'admin' THEN 'admin'
    WHEN au.role = 'office_manager' THEN 'office_manager'
    WHEN au.role = 'reviewer' THEN 'reviewer'
    ELSE 'provider'
  END,
  'active',
  true
FROM app_users au
LEFT JOIN practices p ON p.id = au.practice_id
WHERE au.auth_user_id IS NOT NULL
ON CONFLICT (auth_user_id, practice_id) DO NOTHING;

ALTER TABLE clinic_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team full access on clinic memberships" ON clinic_memberships;
CREATE POLICY "Team full access on clinic memberships" ON clinic_memberships
  FOR ALL
  USING (public.is_team_role())
  WITH CHECK (public.is_team_role());

DROP POLICY IF EXISTS "Users read own clinic memberships" ON clinic_memberships;
CREATE POLICY "Users read own clinic memberships" ON clinic_memberships
  FOR SELECT
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own clinic membership defaults" ON clinic_memberships;
CREATE POLICY "Users manage own clinic membership defaults" ON clinic_memberships
  FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
