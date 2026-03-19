-- Activation funnel tracking for self-service agent
-- Tracks user milestones: signup → first_analysis → repeat_usage → conversion → addon_upsell

CREATE TABLE IF NOT EXISTS activation_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  practice_id UUID REFERENCES practices(id),
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activation_events_user ON activation_events(user_id);
CREATE INDEX idx_activation_events_type ON activation_events(event_type);
CREATE INDEX idx_activation_events_created ON activation_events(created_at);

-- Agent run log — tracks every agent execution for debugging and auditing
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name TEXT NOT NULL,
  action TEXT NOT NULL,
  result JSONB DEFAULT '{}',
  error TEXT,
  ran_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_runs_name ON agent_runs(agent_name);
CREATE INDEX idx_agent_runs_ran_at ON agent_runs(ran_at);

-- Nudge tracking — prevents duplicate emails from agents
CREATE TABLE IF NOT EXISTS agent_nudges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  practice_id UUID REFERENCES practices(id),
  agent_name TEXT NOT NULL,
  nudge_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_nudges_user ON agent_nudges(user_id);
CREATE INDEX idx_agent_nudges_type ON agent_nudges(agent_name, nudge_type);

-- Prevent sending the same nudge to the same user within a window
CREATE UNIQUE INDEX idx_agent_nudges_dedup
  ON agent_nudges(user_id, agent_name, nudge_type, (sent_at::date));

ALTER TABLE activation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on activation_events"
  ON activation_events FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on agent_runs"
  ON agent_runs FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on agent_nudges"
  ON agent_nudges FOR ALL USING (true) WITH CHECK (true);
