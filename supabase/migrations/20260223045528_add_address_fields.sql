-- Add address fields to practices for billing/invoicing
ALTER TABLE practices ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS city_state_zip TEXT;
