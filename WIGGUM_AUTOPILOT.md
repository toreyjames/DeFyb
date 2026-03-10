# Wiggum Autopilot

## Goal
Keep DeFyb improving in short, safe loops while preserving the core path:
landing -> login -> revenue capture tool -> measurable billing lift.

## Current State (March 10, 2026)
- Practice login is live (Google/Microsoft/email/password).
- Team login is live with domain/email allowlist controls.
- Revenue Capture Tool is live for practice users.
- Team dashboard defaults to revenue-capture view.

## Autopilot Loop
1. Observe
- Review conversion blockers in login and first-use flow.
- Review top friction/error states from auth and tool usage.

2. Improve
- Ship one UX improvement that reduces friction.
- Ship one product improvement tied to revenue capture clarity.

3. Verify
- Run build.
- Browser-check landing, practice login, team login, and first tool action.

4. Log
- Append outcomes and next target.

## Pass Log
### Pass 1
- Added practice login and direct revenue capture tool access.
- Added Wiggum loop tracking.

### Pass 2
- Normalized auth error messaging for practice/team login.
- Added clearer handling for rate limits, invalid email format, and provider failures.
- Prevented repeated OAuth click spam while loading.

### Pass 3
- Added copy buttons for billing summary and suggested note additions.
- Added recent analyses panel (last 20) in the revenue tool.
- Added low-confidence guardrail message for manual review.
- Added explicit route intent support for `/team` and `/tool`.
- Added draft PR automation workflow for future low-risk autofixes.

## Next Recommended Pass
1. Add copy buttons for:
- billing rationale
- suggested note additions

2. Add recent analyses list (last 20, local/session for MVP).

3. Add confidence guardrail:
- low confidence -> show "manual review required" state.

4. Add side-by-side comparison:
- billed code vs recommended code with estimated delta.
