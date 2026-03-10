# DeFyb Wiggum Loop

## Product Intent Snapshot
DeFyb is a coding-first revenue capture product.
Core path: encounter documentation -> coding recommendation -> documentation gap closure -> revenue recovery.

## Where We Left Off
- Front page already simplified with clear tagline and short explainer.
- Team auth had Google/Microsoft + email login and domain controls.
- Team dashboard existed, but mixed pipeline operations and revenue focus.
- Practice-side "login" previously pointed to a placeholder screen.

## What Was Improved This Pass
- Added a real practice login flow (`PracticeLogin`) with:
  - Google OAuth
  - Microsoft OAuth
  - Magic link email auth
  - Password fallback
- Added a direct doctor/practice tool screen (`RevenueCaptureTool`) so users can use the product immediately after login.
- Added deterministic analysis logic (`analyzeEncounterNote`) to output:
  - Suggested E/M code
  - Rationale bullets
  - Documentation gaps
  - Suggested compliant note additions
  - Estimated per-visit and monthly recovery
- Kept team login separate and role-gated.
- Shifted team dashboard default to `Revenue Capture` view and changed top KPI cards toward revenue capture metrics.

## Customer-Angle Review Grid
1. Provider (speed + confidence)
- Good now: direct login to usable tool, concise outputs, less navigation overhead.
- Next: one-click copy buttons for billing summary and note additions.

2. Billing Lead (evidence + corrections)
- Good now: rationale/gap structure is visible and deterministic.
- Next: add "current billed code" vs "recommended code" discrepancy queue export.

3. Practice Owner/Admin (financial clarity)
- Good now: team KPIs now start with coding/revenue recovery metrics.
- Next: add trend graph for weekly underbilling reduction and realized collections.

4. Compliance/Risk (defensibility)
- Good now: tool suggests additions rather than fabricating chart details.
- Next: label each recommendation with "source evidence found/not found" traces.

## Next Wiggum Iteration (Recommended)
1. Add copy/export actions in tool output (note addendum + billing rationale).
2. Add encounter history table for last 20 analyses.
3. Add confidence guardrails:
- below threshold -> "manual review required" state.
4. Add specialty templates (Ortho, FM, IM, PM&R) for better gap wording.
5. Add Stripe plan gate around saved history/export if monetization is needed.

## Non-Goals For MVP
- No full EHR integration yet.
- No auto-submission of claims.
- No audio processing requirement before proving coding lift.
