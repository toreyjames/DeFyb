# DeFyb Architecture

## Overview
DeFyb is a **fully automated business operations platform** for practice transformation. It handles everything from first contact through ongoing management, including finances, communications, and compliance.

**Views:**
- **Public Site** - Marketing and intake form
- **Team Dashboard** - Pipeline management, quotes, finances, tasks
- **Client Portal** - Progress tracking, metrics, documents

## Tech Stack
- **Frontend:** React 18 + Vite (SPA)
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Realtime)
- **Payments:** Stripe (intents, subscriptions, invoicing)
- **Email:** Resend API
- **PDF:** jsPDF + html2canvas
- **Deployment:** Vercel

## Data Flow

### Client Lifecycle
```
Lead → Assessment → Implementation → Managed
  ↓        ↓            ↓             ↓
Auto-score  Baseline    AI Stack    Monthly
& tasks     capture     deploy      billing
```

### Automation Triggers
| Event | Auto-Actions |
|-------|--------------|
| New lead submitted | Score lead, create tasks, notify team, welcome email |
| Quote sent | Start follow-up sequence (day 2, 5, 10) |
| Payment received | Update status, send receipt, advance stage |
| Stage change | Create tasks, notify client, update portal |
| Health score drops | Alert team, schedule check-in |
| Contract expiring | Renewal outreach (60, 30, 14 days) |

## Key Tables

### `practices`
Core practice data with lifecycle tracking.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `name` | TEXT | Practice name |
| `specialty` | TEXT | Medical specialty |
| `ehr` | TEXT | EHR system |
| `provider_count` | TEXT | Number of providers |
| `stage` | TEXT | lead, assessment, implementation, managed |
| `lead_score` | INTEGER | 0-100 lead quality score |
| `lead_score_breakdown` | JSONB | Score component details |
| `health_score` | INTEGER | 0-100 practice health |
| `referral_code` | TEXT | Unique referral code |
| `stripe_customer_id` | TEXT | Stripe customer ID |
| `payment_status` | TEXT | none, pending, current, overdue |
| `monthly_rate` | NUMERIC | Monthly managed fee |
| `contract_end_date` | DATE | Contract expiration |
| *...baseline/current metrics...* | | |

### `quotes`
Quote generation and tracking.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `practice_id` | UUID | Reference |
| `provider_count` | INTEGER | Quote basis |
| `tools_selected` | JSONB | Array of tool IDs |
| `assessment_fee` | NUMERIC | $2500 (waivable) |
| `implementation_fee` | NUMERIC | Calculated |
| `monthly_fee` | NUMERIC | Managed services |
| `total_value` | NUMERIC | First year value |
| `status` | TEXT | draft, sent, accepted, rejected |

### `payments`
Payment tracking with Stripe integration.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `practice_id` | UUID | Reference |
| `type` | TEXT | assessment, implementation, managed_monthly |
| `amount` | NUMERIC | Payment amount |
| `status` | TEXT | pending, succeeded, failed |
| `stripe_payment_intent_id` | TEXT | Stripe PI |
| `due_date` | DATE | When due |
| `paid_at` | TIMESTAMPTZ | When paid |

### `tasks`
Auto-generated task management.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `practice_id` | UUID | Reference |
| `title` | TEXT | Task description |
| `stage` | TEXT | Which stage |
| `priority` | TEXT | low, normal, high, urgent |
| `status` | TEXT | pending, in_progress, completed |
| `auto_generated` | BOOLEAN | System-created |

### `documents`
Generated documents with signature tracking.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `practice_id` | UUID | Reference |
| `type` | TEXT | quote, msa, scorecard, etc. |
| `requires_signature` | BOOLEAN | E-signature needed |
| `signature_status` | TEXT | pending, signed |

### `email_log`
Email tracking and automation.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `practice_id` | UUID | Reference |
| `template` | TEXT | Email template name |
| `status` | TEXT | queued, sent, delivered |
| `opened_at` | TIMESTAMPTZ | Open tracking |

### `referrals`
Referral program tracking.

| Column | Type | Purpose |
|--------|------|---------|
| `referrer_practice_id` | UUID | Who referred |
| `referred_practice_id` | UUID | Who was referred |
| `referral_code` | TEXT | Tracking code |
| `status` | TEXT | pending, converted, credited |
| `credit_amount` | NUMERIC | $500 default |

### `financial_periods`
Revenue and expense tracking.

| Column | Type | Purpose |
|--------|------|---------|
| `period_type` | TEXT | monthly, quarterly, annual |
| `revenue_total` | NUMERIC | Total revenue |
| `expenses_total` | NUMERIC | Total expenses |
| `profit` | NUMERIC | Net profit |
| `mrr` | NUMERIC | Monthly recurring revenue |

## Pricing Logic

### Quote Calculation
```javascript
assessmentFee = $2,500 (waivable)

implementationFee = (
  $5,000 base
  + $1,500 × providers
  + $500 × tools
) × ehrComplexity × specialtyComplexity

monthlyFee = $500 base + $200 × providers

// Complexity multipliers
ehrComplexity: { standard: 1.0, moderate: 1.25, complex: 1.5 }
specialtyComplexity: { standard: 1.0, surgical: 1.15, behavioral: 1.15 }
```

### Lead Scoring Algorithm
```javascript
score = 50 (base)
  + providerBonus (5-35 pts based on count)
  + painPoints × 10
  + interestDrivers (15-20 pts each)
  + contactRole (5-20 pts)
// Cap at 100
```

### Health Score Algorithm
```javascript
score = 50 (base)
  + metricsImprovement (0-35 pts)
  + engagement (0-20 pts)
  + paymentStatus (-15 to +10 pts)
  + npsScore (-20 to +15 pts)
// Cap at 0-100
```

## Edge Functions

### `stripe-webhook`
Handles Stripe payment events:
- `payment_intent.succeeded` → Update payment, notify team
- `payment_intent.payment_failed` → Mark failed, alert
- `invoice.paid` → Update status
- `customer.subscription.*` → Update practice

### `send-email`
Sends templated emails via Resend:
- Welcome, quote sent, payment received
- Stage changes, scorecards
- Invoice reminders, renewal outreach

### `health-check`
Daily cron job:
- Recalculates health scores
- Generates alerts for score drops
- Checks portal engagement
- Flags contract expirations

### `generate-report`
Scheduled report generation:
- Monthly scorecards
- Quarterly reviews
- Financial period summaries

### `pilot-webhook`
Sends webhook notifications on pilot milestones:
- `pilot_started` - Pilot begins
- `week_completed` - Weekly milestone reached
- `go_decision` / `conditional_decision` / `no_go_decision` - Final decisions
- Supports Slack and generic HTTP endpoints

### `slack-bot`
Full Slack integration with commands, AI, and interactive components:

**Slash Commands:**
- `/defyb status` - Pipeline overview with stage counts
- `/defyb practice [name]` - Look up practice details
- `/defyb quote [providers]` - Quick quote calculator
- `/defyb tasks` - View pending tasks with complete buttons
- `/defyb ask [question]` - Ask Claude AI about practices

**Interactive Components:**
- Complete tasks from Slack
- Update practice status via modal
- Approve/reject quotes inline

**Claude AI Agent:**
- Natural language queries about practices and pilots
- Context-aware responses using live database
- Drafts emails and summarizes data

## Component Architecture

### Key Components
- `QuoteBuilder` - Pricing calculator with preview
- `LeadScoreBadge` - Visual lead quality indicator
- `PaymentStatusBadge` - Payment state display
- `TaskList` - Auto-generated task tracking
- `QuotesList` - Quote history per practice
- `FinancialSummaryCard` - MRR/ARR dashboard
- `ReferralCodeCard` - Referral program UI

### PDF Generation
```javascript
// Quote PDF
generateQuotePDF(quote, practice)

// Monthly scorecard
generateScorecardPDF(practice)
```

## Views

### Team Dashboard Tabs
1. **Pipeline** - Kanban by stage with lead scores
2. **Activity** - Recent activity feed
3. **Finances** - MRR, ARR, payment status
4. **Tasks** - All tasks by stage

### Client Detail View
- Stage actions (advance to next stage)
- Quick actions (create quote, download scorecard)
- Lead score display
- Quotes list
- Task list
- Contact info, pain points
- Metrics comparison
- AI stack status
- Activity log
- Referral code (managed clients)

## AI Tools (with costs)
| Tool | Category | Monthly Cost |
|------|----------|--------------|
| Suki AI Scribe | scribe | $299 |
| Ambience Scribe | scribe | $299 |
| HealOS Scribe | scribe | $199 |
| Assort Health Phone | phone | $650 |
| Claims AI | revenue | $300 |
| PA Automation | workflow | $450 |
| DME In-House Program | revenue | $0 |

## Email Templates
| Template | Trigger | Timing |
|----------|---------|--------|
| welcome | lead_created | Instant |
| quote_sent | quote_sent | Instant |
| quote_followup_* | quote_no_response | Day 2, 5, 10 |
| payment_received | payment_succeeded | Instant |
| stage_change | stage_change | Instant |
| scorecard | monthly | 1st of month |
| invoice_overdue | invoice_overdue | Day 1, 7, 14, 30 |
| renewal_* | contract_expiring | Day -60, -30, -14 |

## Database Triggers

### `calculate_lead_score_trigger`
Auto-calculates lead score on practice insert/update when stage is 'lead'.

### `generate_stage_tasks_trigger`
Auto-generates tasks when practice stage changes.

### `generate_referral_code_trigger`
Creates unique referral code for new practices.

### `update_*_timestamp`
Updates `updated_at` on quotes, payments, tasks.

## Baseline Assessment (Time/Money/Risk)

### Time Metrics
| Field | Type | Purpose |
|-------|------|---------|
| `doc_time_baseline` | NUMERIC | Minutes per patient for documentation |
| `pajama_time_baseline` | NUMERIC | Hours/week after-hours charting |
| `coding_review_time_baseline` | NUMERIC | Minutes per encounter |
| `pa_staff_hours_baseline` | NUMERIC | Staff hours/week on prior auth |
| `peer_to_peer_calls_baseline` | NUMERIC | Calls per week |

### Money Metrics
| Field | Type | Purpose |
|-------|------|---------|
| `has_coder` | BOOLEAN | Practice employs a coder |
| `coder_annual_cost` | NUMERIC | Annual coder cost |
| `em_coding_distribution` | JSONB | % split: {level3, level4, level5} |
| `em_reimbursement_99213/4/5` | NUMERIC | Avg $ per code level |
| `avg_reimbursement_per_visit` | NUMERIC | Average per-visit revenue |
| `days_in_ar_baseline` | NUMERIC | Days in accounts receivable |

### Risk Metrics
| Field | Type | Purpose |
|-------|------|---------|
| `tribal_knowledge` | JSONB | Who knows what: {pa_requirements, billing_exceptions, ehr_workarounds, coding_rules} |

### ROI Projections
| Field | Type | Purpose |
|-------|------|---------|
| `roi_projections` | JSONB | Calculated ROI: {timeSavedAnnualHours, timeSavedAnnualValue, codingUpliftAnnual, totalAnnualValue, breakdown[]} |

## Pilot Tracking (Week 1-4)

| Field | Type | Purpose |
|-------|------|---------|
| `pilot_start_date` | DATE | When pilot began |
| `pilot_status` | TEXT | not_started, week1, week2, week3, week4, completed |
| `pilot_checklist` | JSONB | Progress by week (see below) |

### Week 1: Scribe Selection
- scribe_selected, scribe_vendor, account_created, mobile_app_installed, first_note_generated

### Week 2: EHR Integration
- ehr_integration_started, integration_type, test_patient_synced, note_template_configured

### Week 3: Full-Day Pilot
- full_day_pilot, pilot_date, notes_reviewed, time_saved_estimate, provider_feedback

### Week 4: Coding Analysis
- coding_analysis_complete, coding_uplift_identified, go_no_go_decision (go/conditional/no_go)

## ROI Calculator

Calculates projected ROI from baseline data:
```javascript
// Time savings
docTimeSaved = (baseline - 3 min) * patientsPerDay * 250 days
timeSavedValue = hours * $200/hr * providers

// Coding uplift (10% shift from 99213 → 99214/99215)
codingUplift = newRevenue - currentRevenue

// Additional savings
coderSavings = hasCoder ? coderCost * 0.5 : 0
denialReduction = denialRate * 0.5 * claims * avgReimbursement
```

## Migrations
1. `20260222000001_baseline_assessment.sql` - Original schema
2. `20260222000002_business_operations.sql` - Full business ops
3. `20260223045528_add_address_fields.sql` - Billing address fields
4. `20260225000001_expanded_baseline.sql` - Time/Money/Risk metrics, pilot tracking

## Dynamic Pricing (Edge Config)

AI tool pricing and configuration can be updated instantly without redeploying via Vercel Edge Config.

### Setup
1. Create an Edge Config in Vercel Dashboard
2. Connect it to the DeFyb project
3. Add the `EDGE_CONFIG` environment variable (auto-set when connected)

### Configuration Keys
| Key | Type | Purpose |
|-----|------|---------|
| `aiTools` | Array | AI tool definitions with id, name, category, cost |
| `pricing` | Object | Assessment, implementation, monthly pricing |
| `roiBenchmarks` | Object | ROI calculation benchmarks |
| `version` | String | Config version for tracking |

### Example Edge Config Values
```json
{
  "aiTools": [
    { "id": "suki", "name": "Suki AI Scribe", "category": "scribe", "cost": 299 },
    { "id": "ambience", "name": "Ambience Scribe", "category": "scribe", "cost": 299 }
  ],
  "pricing": {
    "assessment": { "base": 2500 },
    "implementation": { "base": 5000, "perProvider": 1500, "perTool": 500 },
    "monthly": { "base": 500, "perProvider": 200 }
  },
  "version": "1.0.1"
}
```

### Fallback Behavior
If Edge Config is unavailable, the app uses static defaults defined in `DEFAULT_CONFIG`.

## Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_pk

# Vercel Edge Config (auto-set when connected)
EDGE_CONFIG=your_edge_config_connection_string

# Edge Functions
SUPABASE_SERVICE_ROLE_KEY=your_service_key
RESEND_API_KEY=your_resend_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# Slack Integration
SLACK_WEBHOOK_URL=your_slack_webhook_url        # For pilot-webhook notifications
SLACK_BOT_TOKEN=xoxb-your-bot-token             # For slack-bot responses
SLACK_SIGNING_SECRET=your_signing_secret        # For request verification

# Claude AI (for Slack bot)
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Slack App Setup

### 1. Create Slack App
1. Go to https://api.slack.com/apps → Create New App → From scratch
2. Name: "DeFyb", select your workspace

### 2. Configure Bot
1. **OAuth & Permissions** → Add Bot Token Scopes:
   - `chat:write` - Send messages
   - `commands` - Slash commands
   - `app_mentions:read` - Respond to @mentions

2. **Install App** → Install to Workspace → Copy Bot Token

### 3. Set Up Slash Command
1. **Slash Commands** → Create New Command
   - Command: `/defyb`
   - Request URL: `https://ijuhtxskfixsdqindcjd.supabase.co/functions/v1/slack-bot`
   - Description: "DeFyb practice management"

### 4. Enable Interactivity
1. **Interactivity & Shortcuts** → Toggle On
   - Request URL: `https://ijuhtxskfixsdqindcjd.supabase.co/functions/v1/slack-bot`

### 5. Enable Events (for @mentions)
1. **Event Subscriptions** → Toggle On
   - Request URL: `https://ijuhtxskfixsdqindcjd.supabase.co/functions/v1/slack-bot`
   - Subscribe to: `app_mention`, `message.im`

### 6. Add Secrets to Supabase
```bash
npx supabase secrets set SLACK_BOT_TOKEN="xoxb-..."
npx supabase secrets set SLACK_SIGNING_SECRET="..."
npx supabase secrets set ANTHROPIC_API_KEY="sk-ant-..."
```
