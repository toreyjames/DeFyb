# DeFyb Wiggum Autopilot Report

Generated: 2026-05-06T15:52:36.932Z
Live status: **degraded** (HTTP 200; content markers: missing)

## Verification
- [FAIL] Practice login component exists — Missing PracticeLogin
- [FAIL] Team login component exists — Missing TeamLogin
- [FAIL] Revenue capture tool exists — Missing RevenueCaptureTool
- [FAIL] Auth error normalization exists — Missing normalizeAuthError
- [FAIL] Landing CTA points to tool — CTA text not found
- [FAIL] Live site reachable with expected core copy — HTTP 200; content markers: missing

Summary: 0 passed, 6 failed.

## Priority Backlog (Doctor Ease-of-Use)
- P1: Add one-click copy actions in the Revenue Capture Tool
  Why: Doctors need immediate output reuse without manual highlighting.
  Expected outcome: Reduces per-encounter admin friction by removing copy/paste effort.
- P1: Add recent encounter analysis history
  Why: Clinics need quick review of prior coding suggestions and deltas.
  Expected outcome: Improves trust and repeat usage during clinic day.
- P1: Add low-confidence guardrail
  Why: Not every note should auto-suggest high-confidence billing changes.
  Expected outcome: Protects compliance posture and user trust.
- P2: Verify explicit route intents remain intact
  Why: OAuth return routes must stay deterministic for team vs practice.
  Expected outcome: Prevents misrouting after auth callback.
