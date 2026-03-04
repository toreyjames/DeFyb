-- Seed explicit team roles in auth app_metadata.
-- Add additional team emails to the IN (...) list as needed.

UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'::jsonb,
  true
)
WHERE email IN ('torey@defyb.org')
  AND COALESCE(raw_app_meta_data->>'role', '') <> 'admin';
