# DeFyb — Defying the Death of Small Practices

Clinician-led AI implementation platform for small group medical practices.
Current MVP front-end is coding/revenue-capture-first.

## Tech Stack
- React 18 + Vite
- Deploys to Vercel

## Dev
```bash
npm install
npm run dev
```

## Team Login Controls
```bash
VITE_ALLOWED_TEAM_DOMAINS=defyb.org,clinicdomain.com
VITE_ALLOWED_TEAM_EMAILS=owner@clinicdomain.com,admin@clinicdomain.com
```

## Auth + Views
- `public`: simple landing page with direct tool CTA
- `practice-login`: Google/Microsoft/email login for clinic users
- `tool`: encounter note -> billing code/gap/revenue analysis
- `team-login`: internal team auth with allowlist controls
- `team`: internal dashboard (defaults to Revenue Capture view)

## Billing (Supabase Edge Functions)
- `create-billing-checkout`: starts Stripe checkout for core subscription (tiered `$299/$279/$249` per provider with `$599` clinic minimum) with optional implementation fee.
- `create-billing-portal`: opens Stripe customer portal for existing subscribers.
- `stripe-webhook`: syncs subscription/payment status back to Supabase.

Required Supabase secrets:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CORE_1_5_PRICE_ID` (recurring monthly per-provider for 1-5 providers)
- `STRIPE_CORE_6_20_PRICE_ID` (recurring monthly per-provider for 6-20 providers)
- `STRIPE_CORE_21_PLUS_PRICE_ID` (recurring monthly per-provider for 21+ providers)
- `STRIPE_PLATFORM_MINIMUM_PRICE_ID` (optional recurring clinic minimum line item)
- `STRIPE_BASELINE_PRICE_ID` + `STRIPE_ADDITIONAL_PROVIDER_PRICE_ID` (legacy fallback)
- `STRIPE_IMPLEMENTATION_PRICE_ID` (optional one-time implementation fee)

## CMS Fee Schedule Import (Versioned)
Use the importer to load CMS PFS rates into `payer_rates` with immutable version tracking in `fee_schedule_versions`.

```bash
SUPABASE_URL="https://<project>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
CMS_PFS_FILE="./data/cms-pfs.csv" \
CMS_PFS_VERSION="cms-2026.1" \
CMS_EFFECTIVE_DATE="2026-01-01" \
CMS_CODE_COLUMN="HCPCS Code" \
CMS_AMOUNT_COLUMN="NonFacility Amount" \
CMS_STATE_COLUMN="State" \
CMS_LOCALITY_COLUMN="Locality" \
CMS_ACTIVATE="true" \
npm run cms:import
```

Notes:
- By default import scope is `99202/99203/99204/99213/99214/99215/99024`.
- Set `CMS_ALLOW_ALL_CODES=true` to import the full file.
- `encounters-api` now prefers: payer-specific manual rates -> active CMS PFS version -> fallback rates.
