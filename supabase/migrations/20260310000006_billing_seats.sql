-- Add seat tracking fields for provider-based pricing.

ALTER TABLE billing_profiles
  ADD COLUMN IF NOT EXISTS licensed_provider_count INTEGER DEFAULT 1;

ALTER TABLE billing_profiles
  ADD COLUMN IF NOT EXISTS active_provider_count INTEGER DEFAULT 1;

