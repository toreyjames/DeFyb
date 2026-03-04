-- DeFyb Business Operations Platform
-- Complete database schema for quotes, payments, documents, tasks, and automation

-- ============================================================
-- QUOTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  version INTEGER DEFAULT 1,

  -- Inputs
  provider_count INTEGER,
  tools_selected JSONB DEFAULT '[]', -- Array of tool IDs
  ehr_complexity TEXT CHECK (ehr_complexity IN ('standard', 'moderate', 'complex')),
  specialty_complexity TEXT CHECK (specialty_complexity IN ('standard', 'surgical', 'behavioral')),
  payment_structure TEXT CHECK (payment_structure IN ('standard', 'monthly_6', 'success', 'enterprise')),

  -- Calculated amounts
  assessment_fee NUMERIC DEFAULT 2500,
  assessment_waived BOOLEAN DEFAULT false,
  implementation_fee NUMERIC,
  monthly_fee NUMERIC,
  discount_percent NUMERIC DEFAULT 0,
  discount_reason TEXT,
  total_value NUMERIC, -- Total contract value

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,

  -- Notes
  internal_notes TEXT,
  client_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_practice_id ON quotes(practice_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);

-- ============================================================
-- PAYMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id),

  -- Payment type
  type TEXT NOT NULL CHECK (type IN (
    'assessment',
    'implementation_deposit',
    'implementation_final',
    'managed_monthly',
    'managed_success_share',
    'refund'
  )),

  -- Amount
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'usd',

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'refunded',
    'canceled'
  )),

  -- Stripe integration
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  stripe_subscription_id TEXT,
  stripe_charge_id TEXT,

  -- Scheduling
  due_date DATE,
  paid_at TIMESTAMPTZ,

  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  failure_reason TEXT,

  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_practice_id ON payments(practice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON payments(due_date);

-- ============================================================
-- DOCUMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id),

  -- Document info
  type TEXT NOT NULL CHECK (type IN (
    'assessment_agreement',
    'quote',
    'msa',
    'change_order',
    'report_assessment',
    'report_weekly',
    'report_golive',
    'scorecard_monthly',
    'scorecard_quarterly',
    'summary_annual',
    'invoice',
    'receipt'
  )),
  title TEXT NOT NULL,
  file_url TEXT,
  file_size INTEGER,
  mime_type TEXT,

  -- Signature tracking
  requires_signature BOOLEAN DEFAULT false,
  signature_status TEXT CHECK (signature_status IN ('pending', 'viewed', 'signed', 'declined')),
  signed_at TIMESTAMPTZ,
  signer_name TEXT,
  signer_email TEXT,
  signer_ip TEXT,

  -- Delivery tracking
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,

  -- Version control
  version INTEGER DEFAULT 1,
  supersedes_id UUID REFERENCES documents(id),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_practice_id ON documents(practice_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_signature_status ON documents(signature_status) WHERE requires_signature = true;

-- ============================================================
-- TASKS TABLE (auto-generated per stage)
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,

  -- Task info
  title TEXT NOT NULL,
  description TEXT,
  stage TEXT, -- Which stage this belongs to

  -- Assignment
  assigned_to TEXT, -- Team member email or name
  due_date DATE,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'canceled')),
  completed_at TIMESTAMPTZ,
  completed_by TEXT,

  -- Automation
  auto_generated BOOLEAN DEFAULT true,
  template_id TEXT, -- Reference to task template
  trigger_event TEXT, -- What triggered this task

  -- Dependencies
  blocked_by UUID REFERENCES tasks(id),

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_practice_id ON tasks(practice_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);

-- ============================================================
-- EMAIL LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,

  -- Email info
  template TEXT NOT NULL, -- 'welcome', 'quote_sent', 'payment_received', etc.
  subject TEXT NOT NULL,
  recipient TEXT NOT NULL,
  from_email TEXT DEFAULT 'torey@defyb.org',

  -- Content
  body_html TEXT,
  body_text TEXT,

  -- Status
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'failed')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Engagement tracking
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  click_count INTEGER DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Resend integration
  resend_id TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_log_practice_id ON email_log(practice_id);
CREATE INDEX IF NOT EXISTS idx_email_log_template ON email_log(template);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log(status);
CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON email_log(sent_at);

-- ============================================================
-- REFERRALS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_practice_id UUID REFERENCES practices(id) ON DELETE SET NULL,
  referred_practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,

  -- Referral tracking
  referral_code TEXT UNIQUE NOT NULL,
  referral_source TEXT, -- 'link', 'email', 'manual'

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'credited', 'expired', 'invalid')),

  -- Conversion tracking
  converted_at TIMESTAMPTZ,
  conversion_stage TEXT, -- At which stage was credit earned

  -- Credit info
  credit_amount NUMERIC DEFAULT 500,
  credit_type TEXT DEFAULT 'cash' CHECK (credit_type IN ('cash', 'credit', 'discount')),
  credited_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_practice_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_practice_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- ============================================================
-- FINANCIAL PERIODS TABLE (for reporting)
-- ============================================================
CREATE TABLE IF NOT EXISTS financial_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Revenue breakdown
  revenue_assessment NUMERIC DEFAULT 0,
  revenue_implementation NUMERIC DEFAULT 0,
  revenue_managed NUMERIC DEFAULT 0,
  revenue_success_share NUMERIC DEFAULT 0,
  revenue_total NUMERIC DEFAULT 0,

  -- Expense breakdown
  expenses_tools NUMERIC DEFAULT 0,
  expenses_contractors NUMERIC DEFAULT 0,
  expenses_software NUMERIC DEFAULT 0,
  expenses_travel NUMERIC DEFAULT 0,
  expenses_other NUMERIC DEFAULT 0,
  expenses_total NUMERIC DEFAULT 0,

  -- Profit
  profit NUMERIC DEFAULT 0,
  profit_margin NUMERIC DEFAULT 0,

  -- Metrics
  client_count INTEGER DEFAULT 0,
  mrr NUMERIC DEFAULT 0,
  arr NUMERIC DEFAULT 0,
  churn_rate NUMERIC DEFAULT 0,
  ltv NUMERIC DEFAULT 0,

  -- Status
  finalized BOOLEAN DEFAULT false,
  finalized_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_financial_periods_type ON financial_periods(period_type);
CREATE INDEX IF NOT EXISTS idx_financial_periods_dates ON financial_periods(period_start, period_end);

-- ============================================================
-- EXPENSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Categorization
  category TEXT NOT NULL CHECK (category IN (
    'tools',
    'contractors',
    'software',
    'travel',
    'marketing',
    'office',
    'professional_services',
    'other'
  )),
  subcategory TEXT,

  -- Amount
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'usd',

  -- Details
  description TEXT NOT NULL,
  vendor TEXT,
  receipt_url TEXT,

  -- Date
  expense_date DATE NOT NULL,

  -- Association (optional)
  practice_id UUID REFERENCES practices(id) ON DELETE SET NULL,

  -- Tax info
  tax_deductible BOOLEAN DEFAULT true,
  tax_category TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reimbursed')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_practice ON expenses(practice_id);

-- ============================================================
-- CONTRACTORS TABLE (for 1099 generation)
-- ============================================================
CREATE TABLE IF NOT EXISTS contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  name TEXT NOT NULL,
  business_name TEXT,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'US',

  -- Tax info
  tax_id TEXT, -- SSN or EIN (encrypted in practice)
  tax_id_type TEXT CHECK (tax_id_type IN ('ssn', 'ein')),
  w9_received BOOLEAN DEFAULT false,
  w9_date DATE,

  -- Payment info
  payment_method TEXT DEFAULT 'ach' CHECK (payment_method IN ('ach', 'check', 'paypal', 'other')),
  payment_details JSONB DEFAULT '{}',

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),

  -- YTD tracking
  ytd_payments NUMERIC DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contractors_email ON contractors(email);
CREATE INDEX IF NOT EXISTS idx_contractors_status ON contractors(status);

-- ============================================================
-- CONTRACTOR PAYMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS contractor_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID REFERENCES contractors(id) ON DELETE CASCADE,

  -- Amount
  amount NUMERIC NOT NULL,

  -- Details
  description TEXT NOT NULL,
  payment_date DATE NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  paid_at TIMESTAMPTZ,

  -- Reference
  reference_number TEXT,

  -- Tax year
  tax_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contractor_payments_contractor ON contractor_payments(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_payments_tax_year ON contractor_payments(tax_year);

-- ============================================================
-- EMAIL SEQUENCES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,

  -- Sequence info
  sequence_type TEXT NOT NULL, -- 'quote_followup', 'payment_reminder', 'renewal', etc.
  current_step INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT now(),
  next_email_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'canceled')),

  -- Context
  context JSONB DEFAULT '{}', -- Additional data for the sequence

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_sequences_practice ON email_sequences(practice_id);
CREATE INDEX IF NOT EXISTS idx_email_sequences_status ON email_sequences(status);
CREATE INDEX IF NOT EXISTS idx_email_sequences_next_email ON email_sequences(next_email_at) WHERE status = 'active';

-- ============================================================
-- PRACTICES TABLE UPDATES
-- ============================================================

-- Lead scoring
ALTER TABLE practices ADD COLUMN IF NOT EXISTS lead_score INTEGER;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS lead_score_breakdown JSONB DEFAULT '{}';

-- Referral
ALTER TABLE practices ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES practices(id);
ALTER TABLE practices ADD COLUMN IF NOT EXISTS referral_credits NUMERIC DEFAULT 0;

-- NPS/Satisfaction
ALTER TABLE practices ADD COLUMN IF NOT EXISTS nps_score INTEGER;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS last_nps_date DATE;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS satisfaction_notes TEXT;

-- Stripe integration
ALTER TABLE practices ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;

-- Payment status
ALTER TABLE practices ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'none'
  CHECK (payment_status IN ('none', 'pending', 'current', 'overdue', 'suspended'));
ALTER TABLE practices ADD COLUMN IF NOT EXISTS last_payment_date DATE;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS next_billing_date DATE;

-- Contract info
ALTER TABLE practices ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS contract_end_date DATE;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS contract_value NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS monthly_rate NUMERIC;

-- Engagement tracking
ALTER TABLE practices ADD COLUMN IF NOT EXISTS last_portal_login TIMESTAMPTZ;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS portal_login_count INTEGER DEFAULT 0;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS last_email_response TIMESTAMPTZ;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS last_qbr_date DATE;

-- Value tracking
ALTER TABLE practices ADD COLUMN IF NOT EXISTS total_value_delivered NUMERIC DEFAULT 0;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS months_active INTEGER DEFAULT 0;

-- Generate unique referral code for existing practices
UPDATE practices
SET referral_code = UPPER(SUBSTRING(MD5(id::text || created_at::text) FROM 1 FOR 8))
WHERE referral_code IS NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;

-- Team can do everything (authenticated) - drop first to make idempotent
DROP POLICY IF EXISTS "Team full access on quotes" ON quotes;
CREATE POLICY "Team full access on quotes" ON quotes
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Team full access on payments" ON payments;
CREATE POLICY "Team full access on payments" ON payments
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Team full access on documents" ON documents;
CREATE POLICY "Team full access on documents" ON documents
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Team full access on tasks" ON tasks;
CREATE POLICY "Team full access on tasks" ON tasks
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Team full access on email_log" ON email_log;
CREATE POLICY "Team full access on email_log" ON email_log
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Team full access on referrals" ON referrals;
CREATE POLICY "Team full access on referrals" ON referrals
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Team full access on financial_periods" ON financial_periods;
CREATE POLICY "Team full access on financial_periods" ON financial_periods
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Team full access on expenses" ON expenses;
CREATE POLICY "Team full access on expenses" ON expenses
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Team full access on contractors" ON contractors;
CREATE POLICY "Team full access on contractors" ON contractors
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Team full access on contractor_payments" ON contractor_payments;
CREATE POLICY "Team full access on contractor_payments" ON contractor_payments
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Team full access on email_sequences" ON email_sequences;
CREATE POLICY "Team full access on email_sequences" ON email_sequences
  FOR ALL USING (auth.role() = 'authenticated');

-- Anon can view documents for signature (via URL token - implement in app)
DROP POLICY IF EXISTS "Anon can view public documents" ON documents;
CREATE POLICY "Anon can view public documents" ON documents
  FOR SELECT USING (signature_status = 'pending' AND requires_signature = true);

-- ============================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================

-- Enable realtime for key tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'quotes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE quotes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE payments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;
END $$;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to calculate lead score (returns score only, no side effects)
CREATE OR REPLACE FUNCTION calculate_lead_score(practice_record practices)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 50; -- Base score
  provider_text TEXT;
  pain_count INTEGER;
BEGIN
  -- Parse provider count from text ranges like "1-2", "3-5", "6-10", "11+"
  provider_text := COALESCE(practice_record.provider_count, '');

  -- Provider count scoring based on text ranges
  IF provider_text LIKE '11%' OR provider_text LIKE '11+%' OR provider_text ~ '^[1-9][1-9]' THEN
    score := score + 35;
  ELSIF provider_text LIKE '6%' OR provider_text LIKE '6-%' OR provider_text LIKE '7%' OR provider_text LIKE '8%' OR provider_text LIKE '9%' OR provider_text LIKE '10%' THEN
    score := score + 25;
  ELSIF provider_text LIKE '3%' OR provider_text LIKE '4%' OR provider_text LIKE '5%' THEN
    score := score + 15;
  ELSIF provider_text LIKE '1%' OR provider_text LIKE '2%' THEN
    score := score + 5;
  END IF;

  -- Pain points (each selected adds 10) - pain_points is text[]
  pain_count := COALESCE(array_length(practice_record.pain_points, 1), 0);
  score := score + (pain_count * 10);

  -- Interest drivers (JSONB array, use ? operator for contains)
  IF practice_record.interest_drivers ? 'Stay independent' THEN
    score := score + 20;
  END IF;

  IF practice_record.interest_drivers ? 'High denial rate' THEN
    score := score + 15;
  END IF;

  IF practice_record.interest_drivers ? 'Providers working late' THEN
    score := score + 15;
  END IF;

  -- Contact role
  IF practice_record.contact_role IN ('Owner', 'Partner', 'Physician') THEN
    score := score + 20;
  ELSIF practice_record.contact_role IN ('Administrator', 'Manager', 'Office Manager') THEN
    score := score + 10;
  ELSE
    score := score + 5;
  END IF;

  -- Cap at 100
  IF score > 100 THEN
    score := 100;
  END IF;

  RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate tasks for a stage
CREATE OR REPLACE FUNCTION generate_stage_tasks(
  p_practice_id UUID,
  p_stage TEXT
) RETURNS void AS $$
DECLARE
  task_templates JSONB;
BEGIN
  -- Define task templates per stage
  task_templates := '{
    "lead": [
      {"title": "Review intake submission", "priority": "high"},
      {"title": "Initial outreach call", "priority": "high"},
      {"title": "Send quote", "priority": "normal"}
    ],
    "assessment": [
      {"title": "Schedule baseline data collection", "priority": "high"},
      {"title": "Complete baseline assessment", "priority": "high"},
      {"title": "Generate assessment report", "priority": "normal"},
      {"title": "Present findings to client", "priority": "high"},
      {"title": "Collect signed MSA", "priority": "high"},
      {"title": "Collect implementation deposit", "priority": "high"}
    ],
    "implementation": [
      {"title": "Kick-off call", "priority": "high"},
      {"title": "Environment setup", "priority": "high"},
      {"title": "Tool deployment", "priority": "high"},
      {"title": "Staff training sessions", "priority": "normal"},
      {"title": "Go-live preparation", "priority": "high"},
      {"title": "Go-live day support", "priority": "urgent"},
      {"title": "Post-go-live check-in (day 3)", "priority": "normal"},
      {"title": "Post-go-live check-in (day 7)", "priority": "normal"},
      {"title": "Post-go-live check-in (day 14)", "priority": "normal"}
    ],
    "managed": [
      {"title": "Monthly metrics review", "priority": "normal"},
      {"title": "Generate scorecard", "priority": "normal"},
      {"title": "Quarterly business review", "priority": "high"},
      {"title": "Annual renewal discussion", "priority": "high"}
    ]
  }'::JSONB;

  -- Insert tasks for the stage
  INSERT INTO tasks (practice_id, title, stage, priority, auto_generated, trigger_event)
  SELECT
    p_practice_id,
    task->>'title',
    p_stage,
    task->>'priority',
    true,
    'stage_change'
  FROM jsonb_array_elements(task_templates->p_stage) AS task
  WHERE NOT EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.practice_id = p_practice_id
    AND t.title = task->>'title'
    AND t.stage = p_stage
  );
END;
$$ LANGUAGE plpgsql;

-- Function to calculate health score
CREATE OR REPLACE FUNCTION calculate_health_score(practice_record practices)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 50; -- Base score
BEGIN
  -- Metrics improvement
  IF practice_record.doc_time_baseline IS NOT NULL AND practice_record.doc_time_current IS NOT NULL THEN
    IF (1 - practice_record.doc_time_current / NULLIF(practice_record.doc_time_baseline, 0)) > 0.5 THEN
      score := score + 15; -- >50% improvement in doc time
    END IF;
  END IF;

  IF practice_record.denial_rate_baseline IS NOT NULL AND practice_record.denial_rate_current IS NOT NULL THEN
    IF (practice_record.denial_rate_baseline - practice_record.denial_rate_current) > 3 THEN
      score := score + 10; -- >3pp reduction in denial rate
    END IF;
  END IF;

  IF practice_record.call_answer_rate_baseline IS NOT NULL AND practice_record.call_answer_rate_current IS NOT NULL THEN
    IF (practice_record.call_answer_rate_current - practice_record.call_answer_rate_baseline) > 20 THEN
      score := score + 10; -- >20pp improvement in call rate
    END IF;
  END IF;

  -- Engagement
  IF practice_record.last_portal_login IS NOT NULL AND
     practice_record.last_portal_login > NOW() - INTERVAL '30 days' THEN
    score := score + 5; -- Portal login this month
  END IF;

  IF practice_record.last_email_response IS NOT NULL AND
     practice_record.last_email_response > NOW() - INTERVAL '14 days' THEN
    score := score + 5; -- Responded to recent email
  END IF;

  IF practice_record.last_qbr_date IS NOT NULL AND
     practice_record.last_qbr_date > CURRENT_DATE - INTERVAL '90 days' THEN
    score := score + 10; -- Attended recent QBR
  END IF;

  -- Payment
  IF practice_record.payment_status = 'current' THEN
    score := score + 10;
  ELSIF practice_record.payment_status = 'overdue' THEN
    score := score - 15;
  END IF;

  -- NPS
  IF practice_record.nps_score IS NOT NULL THEN
    IF practice_record.nps_score >= 9 THEN
      score := score + 15;
    ELSIF practice_record.nps_score >= 7 THEN
      score := score + 5;
    ELSIF practice_record.nps_score <= 6 THEN
      score := score - 20;
    END IF;
  END IF;

  -- Cap between 0 and 100
  IF score > 100 THEN score := 100; END IF;
  IF score < 0 THEN score := 0; END IF;

  RETURN score;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Trigger to auto-calculate lead score on insert/update
CREATE OR REPLACE FUNCTION trigger_calculate_lead_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage = 'lead' AND (
    TG_OP = 'INSERT' OR
    OLD.pain_points IS DISTINCT FROM NEW.pain_points OR
    OLD.interest_drivers IS DISTINCT FROM NEW.interest_drivers OR
    OLD.contact_role IS DISTINCT FROM NEW.contact_role OR
    OLD.provider_count IS DISTINCT FROM NEW.provider_count
  ) THEN
    NEW.lead_score := calculate_lead_score(NEW);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_lead_score_trigger ON practices;
CREATE TRIGGER calculate_lead_score_trigger
  BEFORE INSERT OR UPDATE ON practices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_lead_score();

-- Trigger to auto-generate tasks on stage change
CREATE OR REPLACE FUNCTION trigger_generate_stage_tasks()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    PERFORM generate_stage_tasks(NEW.id, NEW.stage);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_stage_tasks_trigger ON practices;
CREATE TRIGGER generate_stage_tasks_trigger
  AFTER UPDATE ON practices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_stage_tasks();

-- Trigger to generate referral code for new practices
CREATE OR REPLACE FUNCTION trigger_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_referral_code_trigger ON practices;
CREATE TRIGGER generate_referral_code_trigger
  BEFORE INSERT ON practices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_referral_code();

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION trigger_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_quotes_timestamp ON quotes;
CREATE TRIGGER update_quotes_timestamp
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS update_payments_timestamp ON payments;
CREATE TRIGGER update_payments_timestamp
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

DROP TRIGGER IF EXISTS update_tasks_timestamp ON tasks;
CREATE TRIGGER update_tasks_timestamp
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- ============================================================
-- INITIAL TASK GENERATION FOR EXISTING PRACTICES
-- ============================================================
DO $$
DECLARE
  practice_record RECORD;
BEGIN
  FOR practice_record IN SELECT id, stage FROM practices WHERE stage IS NOT NULL
  LOOP
    PERFORM generate_stage_tasks(practice_record.id, practice_record.stage);
  END LOOP;
END $$;

-- Lead scores will be calculated by the trigger on future inserts/updates
-- For existing leads, scores will populate when their data is next modified
