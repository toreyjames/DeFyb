-- Startup Metrics & Accountability Tracking
-- Tracks streaks, wins, and engagement for the DeFyb team

CREATE TABLE IF NOT EXISTS startup_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL, -- 'streak', 'weekly_summary', 'monthly_summary'
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activity log for tracking changes (if not exists)
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id),
  type TEXT NOT NULL, -- 'stage_change', 'payment', 'task_completed', etc.
  description TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_startup_metrics_type ON startup_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_practice ON activity_log(practice_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
