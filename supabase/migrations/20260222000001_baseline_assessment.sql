-- DeFyb Baseline Assessment, Implementation Tracking & Client Portal
-- Run this migration to add required columns

-- ============================================================
-- PRACTICES TABLE UPDATES
-- ============================================================

-- REQUIRED baseline fields (for ROI calculation)
ALTER TABLE practices ADD COLUMN IF NOT EXISTS doc_time_baseline NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS denial_rate_baseline NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS call_answer_rate_baseline NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS patients_per_day NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS hours_worked_weekly NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS em_coding_distribution JSONB; -- {level3: 45, level4: 40, level5: 15}

-- Interest drivers from intake form
ALTER TABLE practices ADD COLUMN IF NOT EXISTS interest_drivers JSONB DEFAULT '[]';

-- Implementation tracking
ALTER TABLE practices ADD COLUMN IF NOT EXISTS ai_stack JSONB DEFAULT '[]';
ALTER TABLE practices ADD COLUMN IF NOT EXISTS go_live_date DATE;

-- Current metrics (for comparison to baseline)
ALTER TABLE practices ADD COLUMN IF NOT EXISTS doc_time_current NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS denial_rate_current NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS call_answer_rate_current NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS coding_uplift_monthly NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS revenue_recovered_monthly NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS health_score INTEGER;

-- Activity log
ALTER TABLE practices ADD COLUMN IF NOT EXISTS activity_log JSONB DEFAULT '[]';

-- Client portal access
ALTER TABLE practices ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT false;

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  user_type TEXT CHECK (user_type IN ('team', 'client')),
  type TEXT, -- 'stage_change', 'note_added', 'action_required', 'metric_update'
  title TEXT NOT NULL,
  message TEXT,
  action_url TEXT, -- deep link within app
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_practice_id ON notifications(practice_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON notifications(user_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(practice_id, user_type, read) WHERE read = false;

-- Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Team can read team notifications" ON notifications;
CREATE POLICY "Team can read team notifications" ON notifications
  FOR SELECT
  USING (user_type = 'team' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Team can update team notifications" ON notifications;
CREATE POLICY "Team can update team notifications" ON notifications
  FOR UPDATE
  USING (user_type = 'team' AND auth.role() = 'authenticated')
  WITH CHECK (user_type = 'team');

DROP POLICY IF EXISTS "Authenticated can insert notifications" ON notifications;
CREATE POLICY "Authenticated can insert notifications" ON notifications
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anon can insert team notifications" ON notifications;
CREATE POLICY "Anon can insert team notifications" ON notifications
  FOR INSERT
  WITH CHECK (user_type = 'team');

-- ============================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================

-- Enable realtime for notifications table (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- Enable realtime for practices table (for stage changes, etc.)
-- Note: May already be enabled, this is idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'practices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE practices;
  END IF;
END $$;
