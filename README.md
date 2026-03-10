# DeFyb — Defying the Death of Private Practice

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
- `create-billing-checkout`: starts Stripe checkout for baseline subscription (`$299/mo`) with optional implementation fee.
- `create-billing-portal`: opens Stripe customer portal for existing subscribers.
- `stripe-webhook`: syncs subscription/payment status back to Supabase.

Required Supabase secrets:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_BASELINE_PRICE_ID` (recurring monthly baseline)
- `STRIPE_IMPLEMENTATION_PRICE_ID` (optional one-time implementation fee)
