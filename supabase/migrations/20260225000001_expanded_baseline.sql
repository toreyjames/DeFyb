-- DeFyb Expanded Baseline Assessment & Pilot Tracking
-- Adds detailed Time, Money, Risk metrics and pilot progress tracking

-- ============================================================
-- TIME METRICS (Baseline)
-- ============================================================

-- Documentation time per encounter (already exists as doc_time_baseline)
ALTER TABLE practices ADD COLUMN IF NOT EXISTS pajama_time_baseline NUMERIC; -- hours/week after-hours charting
ALTER TABLE practices ADD COLUMN IF NOT EXISTS coding_review_time_baseline NUMERIC; -- minutes per encounter
ALTER TABLE practices ADD COLUMN IF NOT EXISTS pa_staff_hours_baseline NUMERIC; -- staff hours per week on prior auth
ALTER TABLE practices ADD COLUMN IF NOT EXISTS peer_to_peer_calls_baseline NUMERIC; -- calls per week

-- ============================================================
-- MONEY METRICS (Baseline)
-- ============================================================

ALTER TABLE practices ADD COLUMN IF NOT EXISTS has_coder BOOLEAN DEFAULT false;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS coder_annual_cost NUMERIC; -- annual cost if has_coder
ALTER TABLE practices ADD COLUMN IF NOT EXISTS em_reimbursement_99213 NUMERIC; -- avg reimbursement per 99213
ALTER TABLE practices ADD COLUMN IF NOT EXISTS em_reimbursement_99214 NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS em_reimbursement_99215 NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS avg_reimbursement_per_visit NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS days_in_ar_baseline NUMERIC; -- days in accounts receivable

-- ============================================================
-- RISK METRICS (Baseline)
-- ============================================================

-- Tribal knowledge inventory - who knows what
ALTER TABLE practices ADD COLUMN IF NOT EXISTS tribal_knowledge JSONB DEFAULT '{}';
-- Example: {"pa_requirements": "Mary", "billing_exceptions": "John", "ehr_workarounds": "Nobody documented"}

-- ============================================================
-- PILOT PROGRESS TRACKING
-- ============================================================

ALTER TABLE practices ADD COLUMN IF NOT EXISTS pilot_start_date DATE;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS pilot_status TEXT DEFAULT 'not_started';
-- 'not_started', 'week1', 'week2', 'week3', 'week4', 'completed'

-- Pilot checklist progress stored as JSONB
ALTER TABLE practices ADD COLUMN IF NOT EXISTS pilot_checklist JSONB DEFAULT '{
  "week1": {
    "scribe_selected": false,
    "scribe_vendor": null,
    "account_created": false,
    "mobile_app_installed": false,
    "first_note_generated": false,
    "notes": ""
  },
  "week2": {
    "ehr_integration_started": false,
    "integration_type": null,
    "test_patient_synced": false,
    "note_template_configured": false,
    "notes": ""
  },
  "week3": {
    "full_day_pilot": false,
    "pilot_date": null,
    "notes_reviewed": 0,
    "time_saved_estimate": null,
    "provider_feedback": "",
    "notes": ""
  },
  "week4": {
    "coding_analysis_complete": false,
    "em_distribution_current": null,
    "coding_uplift_identified": false,
    "go_no_go_decision": null,
    "notes": ""
  }
}';

-- ============================================================
-- CURRENT METRICS (for comparison to baseline)
-- ============================================================

-- These already exist: doc_time_current, denial_rate_current, call_answer_rate_current
ALTER TABLE practices ADD COLUMN IF NOT EXISTS pajama_time_current NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS coding_review_time_current NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS pa_staff_hours_current NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS peer_to_peer_calls_current NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS days_in_ar_current NUMERIC;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS em_coding_distribution_current JSONB;

-- ============================================================
-- ROI CALCULATIONS (stored for reporting)
-- ============================================================

ALTER TABLE practices ADD COLUMN IF NOT EXISTS roi_projections JSONB DEFAULT '{}';
-- Stores calculated ROI projections:
-- {
--   "time_saved_annual_hours": 520,
--   "time_saved_annual_value": 104000,
--   "coding_uplift_annual": 36000,
--   "denial_reduction_annual": 24000,
--   "total_annual_value": 164000,
--   "calculated_at": "2026-02-25T..."
-- }

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_practices_pilot_status ON practices(pilot_status);
CREATE INDEX IF NOT EXISTS idx_practices_pilot_start ON practices(pilot_start_date);
