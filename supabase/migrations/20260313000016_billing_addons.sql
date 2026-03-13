-- Add add-on tracking fields to billing profiles for activation workflows.

ALTER TABLE IF EXISTS billing_profiles
  ADD COLUMN IF NOT EXISTS selected_addons TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS addon_setup_pending TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stripe_subscription_items JSONB DEFAULT '[]'::jsonb;
