-- Billing profiles map authenticated users to Stripe customer/subscription state.

CREATE TABLE IF NOT EXISTS billing_profiles (
  user_id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  billing_status TEXT DEFAULT 'none' CHECK (billing_status IN ('none', 'trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  plan_code TEXT DEFAULT 'baseline_299',
  implementation_enabled BOOLEAN DEFAULT false,
  licensed_provider_count INTEGER DEFAULT 1,
  active_provider_count INTEGER DEFAULT 1,
  monthly_amount NUMERIC DEFAULT 299,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_profiles_customer ON billing_profiles (stripe_customer_id);

ALTER TABLE billing_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own billing profile" ON billing_profiles;
CREATE POLICY "Users can read own billing profile"
  ON billing_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own billing profile" ON billing_profiles;
CREATE POLICY "Users can insert own billing profile"
  ON billing_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own billing profile" ON billing_profiles;
CREATE POLICY "Users can update own billing profile"
  ON billing_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
